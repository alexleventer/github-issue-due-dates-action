"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const eventemitter3_1 = require("eventemitter3");
const logger_1 = require("./logger");
const errors_1 = require("./errors");
/**
 * An object that monitors activity in an RTMClient and generates ping events in an effort to keep its websocket
 * connection alive. In cases where the websocket connection seems unresponsive, this object emits a
 * `recommend_reconnect` event. That event should be handled by tearing down the websocket connection and
 * opening a new one.
 */
class KeepAlive extends eventemitter3_1.EventEmitter {
    constructor({ clientPingTimeout = 6000, serverPongTimeout = 4000, logger = undefined, logLevel = logger_1.LogLevel.INFO, } = {}) {
        super();
        this.clientPingTimeout = clientPingTimeout;
        this.serverPongTimeout = serverPongTimeout;
        if (this.serverPongTimeout >= this.clientPingTimeout) {
            const error = new Error('Client ping timeout must be less than server pong timeout');
            error.code = errors_1.ErrorCode.KeepAliveConfigError;
            throw error;
        }
        this.isMonitoring = false;
        this.recommendReconnect = false;
        // Logging
        this.logger = logger_1.getLogger(KeepAlive.loggerName, logLevel, logger);
    }
    /**
     * Start monitoring the RTMClient. This method should only be called after the client's websocket is already open.
     */
    start(client) {
        this.logger.debug('start monitoring');
        if (!client.connected) {
            const error = new Error('');
            error.code = errors_1.ErrorCode.KeepAliveClientNotConnected;
            throw error;
        }
        this.client = client;
        this.isMonitoring = true;
        this.client.on('outgoing_message', this.setPingTimer, this);
        this.setPingTimer();
    }
    /**
     * Stop monitoring the RTMClient. This method should be called after the `recommend_reconnect` event is emitted and
     * the client's weboscket is closed. In order to start monitoring the client again, start() needs to be called again
     * after that.
     */
    stop() {
        this.logger.debug('stop monitoring');
        this.clearPreviousPingTimer();
        this.clearPreviousPongTimer();
        if (this.client !== undefined) {
            this.client.off('outgoing_message', this.setPingTimer);
            this.client.off('slack_event', this.attemptAcknowledgePong);
        }
        this.lastPing = this.client = undefined;
        this.recommendReconnect = this.isMonitoring = false;
    }
    /**
     * Clears the ping timer if its set, otherwise this is a noop.
     */
    clearPreviousPingTimer() {
        if (this.pingTimer !== undefined) {
            clearTimeout(this.pingTimer);
            delete this.pingTimer;
        }
    }
    /**
     * Sets the ping timer (including clearing any previous one).
     */
    setPingTimer() {
        // if there's already an unacknowledged ping, we don't need to set up a timer for another to be sent
        if (this.lastPing !== undefined) {
            return;
        }
        this.logger.debug('setting ping timer');
        this.clearPreviousPingTimer();
        this.pingTimer = setTimeout(this.sendPing.bind(this), this.clientPingTimeout);
    }
    /**
     * Sends a ping and manages the timer to wait for a pong.
     */
    sendPing() {
        try {
            if (this.client === undefined) {
                if (!this.isMonitoring) {
                    // if monitoring stopped before the ping timer fires, its safe to return
                    this.logger.debug('stopped monitoring before ping timer fired');
                    return;
                }
                const error = new Error('no client found');
                error.code = errors_1.ErrorCode.KeepAliveInconsistentState;
                throw error;
            }
            this.logger.debug('ping timer expired, sending ping');
            this.client.send('ping')
                .then((messageId) => {
                if (this.client === undefined) {
                    if (!this.isMonitoring) {
                        // if monitoring stopped before the ping is sent, its safe to return
                        this.logger.debug('stopped monitoring before outgoing ping message was finished');
                        return;
                    }
                    const error = new Error('no client found');
                    error.code = errors_1.ErrorCode.KeepAliveInconsistentState;
                    throw error;
                }
                this.lastPing = messageId;
                this.logger.debug('setting pong timer');
                this.pongTimer = setTimeout(() => {
                    if (this.client === undefined) {
                        // if monitoring stopped before the pong timer fires, its safe to return
                        if (!this.isMonitoring) {
                            this.logger.debug('stopped monitoring before pong timer fired');
                            return;
                        }
                        const error = new Error('no client found');
                        error.code = errors_1.ErrorCode.KeepAliveInconsistentState;
                        throw error;
                    }
                    // signal that this pong is done being handled
                    this.client.off('slack_event', this.attemptAcknowledgePong);
                    // no pong received to acknowledge the last ping within the serverPongTimeout
                    this.logger.debug('pong timer expired, recommend reconnect');
                    this.recommendReconnect = true;
                    this.emit('recommend_reconnect');
                }, this.serverPongTimeout);
                this.client.on('slack_event', this.attemptAcknowledgePong, this);
            })
                .catch((error) => {
                this.logger.error(`Unhandled error: ${error.message}. Please report to @slack/rtm-api package maintainers.`);
            });
        }
        catch (error) {
            this.logger.error(`Unhandled error: ${error.message}. Please report to @slack/rtm-api package maintainers.`);
        }
    }
    /**
     * Clears the pong timer if its set, otherwise this is a noop.
     */
    clearPreviousPongTimer() {
        if (this.pongTimer !== undefined) {
            clearTimeout(this.pongTimer);
        }
    }
    /**
     * Determines if a giving incoming event can be treated as an acknowledgement for the outstanding ping, and then
     * clears the ping if so.
     * @param event incoming slack event
     */
    attemptAcknowledgePong(_type, event) {
        if (this.client === undefined) {
            const error = new Error('no client found');
            error.code = errors_1.ErrorCode.KeepAliveInconsistentState;
            throw error;
        }
        if (this.lastPing !== undefined && event.reply_to !== undefined && event.reply_to >= this.lastPing) {
            // this message is a reply that acks the previous ping, clear the last ping
            this.logger.debug('received pong, clearing pong timer');
            delete this.lastPing;
            // signal that this pong is done being handled
            this.clearPreviousPongTimer();
            this.client.off('slack_event', this.attemptAcknowledgePong);
        }
    }
}
/**
 * The name used to prefix all logging generated from this object
 */
KeepAlive.loggerName = 'KeepAlive';
exports.KeepAlive = KeepAlive;
//# sourceMappingURL=KeepAlive.js.map