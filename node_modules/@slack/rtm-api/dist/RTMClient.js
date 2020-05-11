"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const eventemitter3_1 = require("eventemitter3");
const ws_1 = __importDefault(require("ws")); // tslint:disable-line:import-name
const finity_1 = __importDefault(require("finity")); // tslint:disable-line:import-name
const p_queue_1 = __importDefault(require("p-queue")); // tslint:disable-line:import-name
const p_cancelable_1 = __importDefault(require("p-cancelable")); // tslint:disable-line:import-name
const web_api_1 = require("@slack/web-api");
const KeepAlive_1 = require("./KeepAlive");
const logger_1 = require("./logger");
const errors_1 = require("./errors");
const packageJson = require('../package.json'); // tslint:disable-line:no-require-imports no-var-requires
/**
 * An RTMClient allows programs to communicate with the {@link https://api.slack.com/rtm|Slack Platform's RTM API}.
 * This object uses the EventEmitter pattern to dispatch incoming events and has several methods for sending outgoing
 * messages.
 */
class RTMClient extends eventemitter3_1.EventEmitter {
    constructor(token, { slackApiUrl = 'https://slack.com/api/', logger = undefined, logLevel = logger_1.LogLevel.INFO, retryConfig, agent = undefined, autoReconnect = true, useRtmConnect = true, clientPingTimeout, serverPongTimeout, replyAckOnReconnectTimeout = 2000, tls = undefined, } = {}) {
        super();
        /**
         * Whether or not the client is currently connected to the RTM API
         */
        this.connected = false;
        /**
         * Whether or not the client has authenticated to the RTM API. This occurs when the connect method
         * completes, and a WebSocket URL is available for the client's connection.
         */
        this.authenticated = false;
        /**
         * Configuration for the state machine
         */
        this.stateMachineConfig = finity_1.default
            .configure()
            .initialState('disconnected')
            .on('start').transitionTo('connecting')
            .onEnter(() => {
            // each client should start out with the outgoing event queue paused
            this.logger.debug('pausing outgoing event queue');
            this.outgoingEventQueue.pause();
            // when a formerly connected client gets disconnected, all outgoing messages whose promises were waiting
            // for a reply from the server should be canceled
            this.awaitingReplyList.forEach(p => p.cancel());
        })
            .state('connecting')
            .submachine(finity_1.default.configure()
            .initialState('authenticating')
            .do(() => {
            // determine which Web API method to use for the connection
            const connectMethod = this.useRtmConnect ? 'rtm.connect' : 'rtm.start';
            return this.webClient.apiCall(connectMethod, this.startOpts !== undefined ? this.startOpts : {})
                .then((result) => {
                const startData = result;
                // capture identity information
                this.activeUserId = startData.self.id;
                this.activeTeamId = startData.team.id;
                return result;
            });
        })
            .onSuccess().transitionTo('authenticated')
            .onFailure()
            .transitionTo('reconnecting').withCondition((context) => {
            const error = context.error;
            this.logger.info(`unable to RTM start: ${error.message}`);
            // Observe this event when the error which causes reconnecting or disconnecting is meaningful
            this.emit('unable_to_rtm_start', error);
            let isRecoverable = true;
            if (error.code === web_api_1.ErrorCode.PlatformError &&
                Object.values(UnrecoverableRTMStartError).includes(error.data.error)) {
                isRecoverable = false;
            }
            else if (error.code === web_api_1.ErrorCode.RequestError) {
                isRecoverable = false;
            }
            else if (error.code === web_api_1.ErrorCode.HTTPError) {
                isRecoverable = false;
            }
            return this.autoReconnect && isRecoverable;
        })
            .transitionTo('failed')
            .state('authenticated')
            .onEnter((_state, context) => {
            this.authenticated = true;
            this.setupWebsocket(context.result.url);
            setImmediate(() => {
                this.emit('authenticated', context.result);
            });
        })
            .on('websocket open').transitionTo('handshaking')
            .state('handshaking') // a state in which to wait until the 'server hello' event
            .state('failed')
            .onEnter((_state, context) => {
            // dispatch 'failure' on parent machine to transition out of this submachine's states
            this.stateMachine.handle('failure', context.error);
        })
            .global()
            .onStateEnter((state) => {
            this.logger.debug(`transitioning to state: connecting:${state}`);
        })
            .getConfig())
            .on('server hello').transitionTo('connected')
            .on('websocket close')
            .transitionTo('reconnecting').withCondition(() => this.autoReconnect)
            .transitionTo('disconnected').withAction(() => {
            // this transition circumvents the 'disconnecting' state (since the websocket is already closed), so we need
            // to execute its onExit behavior here.
            this.teardownWebsocket();
        })
            .on('failure').transitionTo('disconnected')
            .on('explicit disconnect').transitionTo('disconnecting')
            .state('connected')
            .onEnter(() => {
            this.connected = true;
        })
            .submachine(finity_1.default.configure()
            .initialState('resuming')
            // when a reply to the last message sent is received, we assume that the client is "caught up" from its
            // previous connection
            .on('replay finished').transitionTo('ready')
            // when this client is connecting for the first time, or if the last message sent on the previous connection
            // would not get a reply from the server, or if for any other reason we do not receive a reply to the last
            // message sent - after a timeout, we assume that the client is "caught up"
            .onTimeout(this.replyAckOnReconnectTimeout).transitionTo('ready')
            .onExit(() => {
            // once all replay messages are processed, if there are any more messages awaiting a reply message, let
            // them know that there are none expected to arrive.
            this.awaitingReplyList.forEach(p => p.cancel());
        })
            .state('ready')
            .onEnter(() => {
            this.keepAlive.start(this);
            // the transition isn't done yet, so we delay the following statement until after the event loop returns
            setImmediate(() => {
                this.logger.debug('resuming outgoing event queue');
                this.outgoingEventQueue.start();
                this.emit('ready');
            });
        })
            .global()
            .onStateEnter((state) => {
            this.logger.debug(`transitioning to state: connected:${state}`);
        })
            .getConfig())
            .on('websocket close')
            .transitionTo('reconnecting').withCondition(() => this.autoReconnect)
            .transitionTo('disconnected').withAction(() => {
            // this transition circumvents the 'disconnecting' state (since the websocket is already closed), so we need
            // to execute its onExit behavior here.
            this.teardownWebsocket();
        })
            .on('explicit disconnect').transitionTo('disconnecting')
            .onExit(() => {
            this.connected = false;
            this.authenticated = false;
            // clear data that is now stale
            this.activeUserId = this.activeTeamId = undefined;
            this.keepAlive.stop();
            this.outgoingEventQueue.pause();
        })
            .state('disconnecting')
            .onEnter(() => {
            // Most of the time, a websocket will exist. The only time it does not is when transitioning from connecting,
            // before the rtm.start() has finished and the websocket hasn't been set up.
            if (this.websocket !== undefined) {
                this.websocket.close();
            }
        })
            .on('websocket close').transitionTo('disconnected')
            .onExit(() => this.teardownWebsocket())
            // reconnecting is just like disconnecting, except that the websocket should already be closed before we enter
            // this state, and that the next state should be connecting.
            .state('reconnecting')
            .do(() => {
            this.keepAlive.stop();
            return Promise.resolve(true);
        })
            .onSuccess().transitionTo('connecting')
            .onExit(() => this.teardownWebsocket())
            .global()
            .onStateEnter((state, context) => {
            this.logger.debug(`transitioning to state: ${state}`);
            if (state === 'disconnected') {
                // Emits a `disconnected` event with a possible error object (might be undefined)
                this.emit(state, context.eventPayload);
            }
            else {
                // Emits events: `connecting`, `connected`, `disconnecting`, `reconnecting`
                this.emit(state);
            }
        })
            .getConfig();
        /**
         * The last message ID used for an outgoing message
         */
        this.messageId = 1;
        /**
         * A queue of tasks used to serialize outgoing messages and to allow the client to buffer outgoing messages when
         * its not in the 'ready' state. This queue is paused and resumed as the state machine transitions.
         */
        this.outgoingEventQueue = new p_queue_1.default({ concurrency: 1 });
        /**
         * A list of cancelable Promises that each represent a caller waiting on the server to acknowledge an outgoing
         * message with a response (an incoming message containing a "reply_to" property with the outgoing message's ID).
         * This list is emptied by canceling all the promises when the client no longer expects to receive any replies from
         * the server (when its disconnected or when its reconnected and doesn't expect replies for past outgoing messages).
         * The list is a sparse array, where the indexes are message IDs for the sent messages.
         */
        this.awaitingReplyList = [];
        this.webClient = new web_api_1.WebClient(token, {
            slackApiUrl,
            logger,
            logLevel,
            retryConfig,
            agent,
            tls,
            maxRequestConcurrency: 1,
        });
        this.agentConfig = agent;
        this.autoReconnect = autoReconnect;
        this.useRtmConnect = useRtmConnect;
        this.replyAckOnReconnectTimeout = replyAckOnReconnectTimeout;
        // NOTE: may want to filter the keys to only those acceptable for TLS options
        this.tlsConfig = tls !== undefined ? tls : {};
        this.keepAlive = new KeepAlive_1.KeepAlive({
            clientPingTimeout,
            serverPongTimeout,
            logger,
            logLevel,
        });
        this.keepAlive.on('recommend_reconnect', () => {
            if (this.websocket !== undefined) {
                // this will trigger the 'websocket close' event on the state machine, which transitions to clean up
                this.websocket.close();
                // if the websocket actually is no longer connected, the eventual 'websocket close' event will take a long
                // time, because it won't fire until the close handshake completes. in the meantime, stop the keep alive so we
                // don't send pings on a dead connection.
                this.keepAlive.stop();
            }
        }, this);
        // Logging
        this.logger = logger_1.getLogger(RTMClient.loggerName, logLevel, logger);
        this.stateMachine = finity_1.default.start(this.stateMachineConfig);
        this.logger.debug('initialized');
    }
    /**
     * Begin an RTM session using the provided options. This method must be called before any messages can
     * be sent or received.
     */
    start(options) {
        this.logger.debug('start()');
        // capture options for potential future reconnects
        this.startOpts = options;
        // delegate behavior to state machine
        this.stateMachine.handle('start');
        // return a promise that resolves with the connection information
        return new Promise((resolve, reject) => {
            this.once('authenticated', (result) => {
                this.removeListener('disconnected', reject);
                resolve(result);
            });
            this.once('disconnected', (err) => {
                this.removeListener('authenticated', resolve);
                reject(err);
            });
        });
    }
    /**
     * End an RTM session. After this method is called no messages will be sent or received unless you call
     * start() again later.
     */
    disconnect() {
        return new Promise((resolve, reject) => {
            this.logger.debug('manual disconnect');
            // resolve (or reject) on disconnect
            this.once('disconnected', (err) => {
                if (err instanceof Error) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
            // delegate behavior to state machine
            this.stateMachine.handle('explicit disconnect');
        });
    }
    /**
     * Send a simple message to a public channel, private channel, DM, or MPDM.
     * @param text The message text.
     * @param conversationId A conversation ID for the destination of this message.
     */
    async sendMessage(text, conversationId) {
        return this.addOutgoingEvent(true, 'message', { text, channel: conversationId });
    }
    /**
     * Sends a typing indicator to indicate that the user with `activeUserId` is typing.
     * @param conversationId The destination for where the typing indicator should be shown.
     */
    sendTyping(conversationId) {
        return this.addOutgoingEvent(false, 'typing', { channel: conversationId });
    }
    /**
     * Subscribes this client to presence changes for only the given `userIds`.
     * @param userIds An array of user IDs whose presence you are interested in. This list will replace the list from any
     * previous calls to this method.
     */
    subscribePresence(userIds) {
        return this.addOutgoingEvent(false, 'presence_sub', { ids: userIds });
    }
    addOutgoingEvent(awaitReply, type, body) {
        const awaitReplyTask = (messageId) => {
            const replyPromise = new p_cancelable_1.default((resolve, reject, onCancel) => {
                const eventHandler = (_type, event) => {
                    if (event.reply_to === messageId) {
                        this.off('slack_event', eventHandler);
                        if (event.error !== undefined) {
                            const error = errors_1.platformErrorFromEvent(event);
                            return reject(error);
                        }
                        resolve(event);
                    }
                };
                onCancel(() => {
                    this.off('slack_event', eventHandler);
                    reject(errors_1.noReplyReceivedError());
                });
                this.on('slack_event', eventHandler);
            });
            this.awaitingReplyList[messageId] = replyPromise;
            return replyPromise;
        };
        const sendTask = () => {
            const sendPromise = this.send(type, body);
            if (awaitReply) {
                return sendPromise.then(awaitReplyTask);
            }
            return sendPromise.then(() => Promise.resolve());
        };
        return this.outgoingEventQueue.add(sendTask);
    }
    /**
     * Generic method for sending an outgoing message of an arbitrary type. The main difference between this method and
     * addOutgoingEvent() is that this method does not use a queue so it can only be used while the client is ready
     * to send messages (in the 'ready' substate of the 'connected' state). It returns a Promise for the message ID of the
     * sent message. This is an internal ID and generally shouldn't be used as an identifier for messages (for that,
     * there is `ts` on messages once the server acknowledges it).
     * @param type the message type
     * @param body the message body
     */
    send(type, body = {}) {
        const message = Object.assign({}, body, {
            type,
            id: this.nextMessageId(),
        });
        return new Promise((resolve, reject) => {
            this.logger.debug(`send() in state: ${this.stateMachine.getStateHierarchy()}`);
            if (this.websocket === undefined) {
                this.logger.error('cannot send message when client is not connected');
                reject(errors_1.sendWhileDisconnectedError());
            }
            else if (!(this.stateMachine.getCurrentState() === 'connected' &&
                this.stateMachine.getStateHierarchy()[1] === 'ready')) {
                this.logger.error('cannot send message when client is not ready');
                reject(errors_1.sendWhileNotReadyError());
            }
            else {
                // NOTE: future feature request: middleware pipeline to process the message before its sent
                this.emit('outgoing_message', message);
                const flatMessage = JSON.stringify(message);
                this.logger.debug(`sending message on websocket: ${flatMessage}`);
                this.websocket.send(flatMessage, (error) => {
                    if (error !== undefined) {
                        this.logger.error(`failed to send message on websocket: ${error.message}`);
                        return reject(errors_1.websocketErrorWithOriginal(error));
                    }
                    resolve(message.id);
                });
            }
        });
    }
    /**
     * Atomically increments and returns a message ID for the next message.
     */
    nextMessageId() {
        this.messageId += 1;
        return this.messageId;
    }
    /**
     * Set up method for the client's websocket instance. This method will attach event listeners.
     */
    setupWebsocket(url) {
        // initialize the websocket
        const options = Object.assign({
            perMessageDeflate: false,
        }, this.tlsConfig);
        if (this.agentConfig !== undefined) {
            options.agent = this.agentConfig;
        }
        this.websocket = new ws_1.default(url, options);
        // attach event listeners
        this.websocket.addEventListener('open', event => this.stateMachine.handle('websocket open', event));
        this.websocket.addEventListener('close', event => this.stateMachine.handle('websocket close', event));
        this.websocket.addEventListener('error', (event) => {
            this.logger.error(`A websocket error occurred: ${event.message}`);
            this.emit('error', errors_1.websocketErrorWithOriginal(event.error));
        });
        this.websocket.addEventListener('message', this.onWebsocketMessage.bind(this));
    }
    /**
     * Tear down method for the client's websocket instance. This method undoes the work in setupWebsocket(url).
     */
    teardownWebsocket() {
        if (this.websocket !== undefined) {
            this.websocket.removeAllListeners('open');
            this.websocket.removeAllListeners('close');
            this.websocket.removeAllListeners('error');
            this.websocket.removeAllListeners('message');
            this.websocket = undefined;
        }
    }
    /**
     * `onmessage` handler for the client's websocket. This will parse the payload and dispatch the relevant events for
     * each incoming message.
     */
    onWebsocketMessage({ data }) {
        this.logger.debug(`received message on websocket: ${data}`);
        // parse message into slack event
        let event;
        try {
            event = JSON.parse(data);
        }
        catch (parseError) {
            // prevent application from crashing on a bad message, but log an error to bring attention
            this.logger.error(`unable to parse incoming websocket message: ${parseError.message}\n    message contents: "${data}"`);
            return;
        }
        // internal event handlers
        if (event.type === 'hello') {
            this.stateMachine.handle('server hello');
        }
        if (event.type === 'team_migration_started') {
            if (this.websocket !== undefined) {
                // this will trigger the 'websocket close' event on the state machine, which transitions to clean up
                this.websocket.close();
            }
        }
        if (this.stateMachine.getCurrentState() === 'connected' &&
            this.stateMachine.getStateHierarchy()[1] === 'resuming' &&
            event.reply_to !== undefined && event.reply_to === this.messageId) {
            this.stateMachine.handle('replay finished');
        }
        // emit for event handlers
        this.emit('slack_event', event.type, event);
        this.emit(event.type, event);
        if (event.subtype !== undefined) {
            this.emit(`${event.type}::${event.subtype}`, event);
        }
    }
}
/**
 * The name used to prefix all logging generated from this object
 */
RTMClient.loggerName = 'RTMClient';
exports.RTMClient = RTMClient;
/* Instrumentation */
web_api_1.addAppMetadata({ name: packageJson.name, version: packageJson.version });
exports.default = RTMClient;
/*
 * Helpers
 */
// NOTE: there may be a better way to add metadata to an error about being "unrecoverable" than to keep an
// independent enum, probably a Set (this isn't used as a type).
var UnrecoverableRTMStartError;
(function (UnrecoverableRTMStartError) {
    UnrecoverableRTMStartError["NotAuthed"] = "not_authed";
    UnrecoverableRTMStartError["InvalidAuth"] = "invalid_auth";
    UnrecoverableRTMStartError["AccountInactive"] = "account_inactive";
    UnrecoverableRTMStartError["UserRemovedFromTeam"] = "user_removed_from_team";
    UnrecoverableRTMStartError["TeamDisabled"] = "team_disabled";
})(UnrecoverableRTMStartError || (UnrecoverableRTMStartError = {}));
//# sourceMappingURL=RTMClient.js.map