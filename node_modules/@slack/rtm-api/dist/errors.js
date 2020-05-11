"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * A dictionary of codes for errors produced by this package
 */
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["SendWhileDisconnectedError"] = "slack_rtmapi_send_while_disconnected_error";
    ErrorCode["SendWhileNotReadyError"] = "slack_rtmapi_send_while_not_ready_error";
    ErrorCode["SendMessagePlatformError"] = "slack_rtmapi_send_message_platform_error";
    ErrorCode["WebsocketError"] = "slack_rtmapi_websocket_error";
    ErrorCode["NoReplyReceivedError"] = "slack_rtmapi_no_reply_received_error";
    // internal errors
    ErrorCode["KeepAliveConfigError"] = "slack_rtmapi_keepalive_config_error";
    ErrorCode["KeepAliveClientNotConnected"] = "slack_rtmapi_keepalive_client_not_connected";
    ErrorCode["KeepAliveInconsistentState"] = "slack_rtmapi_keepalive_inconsistent_state";
})(ErrorCode = exports.ErrorCode || (exports.ErrorCode = {}));
/**
 * Factory for producing a {@link CodedError} from a generic error
 */
function errorWithCode(error, code) {
    // NOTE: might be able to return something more specific than a CodedError with conditional typing
    const codedError = error;
    codedError.code = code;
    return codedError;
}
/**
 * A factory to create RTMWebsocketError objects.
 */
function websocketErrorWithOriginal(original) {
    const error = errorWithCode(new Error(`Failed to send message on websocket: ${original.message}`), ErrorCode.WebsocketError);
    error.original = original;
    return error;
}
exports.websocketErrorWithOriginal = websocketErrorWithOriginal;
/**
 * A factory to create RTMPlatformError objects.
 */
function platformErrorFromEvent(event) {
    const error = errorWithCode(new Error(`An API error occurred: ${event.error.msg}`), ErrorCode.SendMessagePlatformError);
    error.data = event;
    return error;
}
exports.platformErrorFromEvent = platformErrorFromEvent;
/**
 * A factory to create RTMNoReplyReceivedError objects.
 */
function noReplyReceivedError() {
    return errorWithCode(new Error('Message sent but no server acknowledgement was received. This may be caused by the client ' +
        'changing connection state rather than any issue with the specific message. Check before resending.'), ErrorCode.NoReplyReceivedError);
}
exports.noReplyReceivedError = noReplyReceivedError;
/**
 * A factory to create RTMSendWhileDisconnectedError objects.
 */
function sendWhileDisconnectedError() {
    return errorWithCode(new Error('Cannot send message when client is not connected'), ErrorCode.NoReplyReceivedError);
}
exports.sendWhileDisconnectedError = sendWhileDisconnectedError;
/**
 * A factory to create RTMSendWhileNotReadyError objects.
 */
function sendWhileNotReadyError() {
    return errorWithCode(new Error('Cannot send message when client is not ready'), ErrorCode.NoReplyReceivedError);
}
exports.sendWhileNotReadyError = sendWhileNotReadyError;
//# sourceMappingURL=errors.js.map