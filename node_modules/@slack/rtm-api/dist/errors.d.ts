/// <reference types="node" />
import { RTMCallResult } from './RTMClient';
/**
 * All errors produced by this package adhere to this interface
 */
export interface CodedError extends NodeJS.ErrnoException {
    code: ErrorCode;
}
/**
 * A dictionary of codes for errors produced by this package
 */
export declare enum ErrorCode {
    SendWhileDisconnectedError = "slack_rtmapi_send_while_disconnected_error",
    SendWhileNotReadyError = "slack_rtmapi_send_while_not_ready_error",
    SendMessagePlatformError = "slack_rtmapi_send_message_platform_error",
    WebsocketError = "slack_rtmapi_websocket_error",
    NoReplyReceivedError = "slack_rtmapi_no_reply_received_error",
    KeepAliveConfigError = "slack_rtmapi_keepalive_config_error",
    KeepAliveClientNotConnected = "slack_rtmapi_keepalive_client_not_connected",
    KeepAliveInconsistentState = "slack_rtmapi_keepalive_inconsistent_state"
}
export declare type RTMCallError = RTMPlatformError | RTMWebsocketError | RTMNoReplyReceivedError | RTMSendWhileDisconnectedError | RTMSendWhileNotReadyError;
export interface RTMPlatformError extends CodedError {
    code: ErrorCode.SendMessagePlatformError;
    data: RTMCallResult;
}
export interface RTMWebsocketError extends CodedError {
    code: ErrorCode.WebsocketError;
    original: Error;
}
export interface RTMNoReplyReceivedError extends CodedError {
    code: ErrorCode.NoReplyReceivedError;
}
export interface RTMSendWhileDisconnectedError extends CodedError {
    code: ErrorCode.SendWhileDisconnectedError;
}
export interface RTMSendWhileNotReadyError extends CodedError {
    code: ErrorCode.SendWhileNotReadyError;
}
/**
 * A factory to create RTMWebsocketError objects.
 */
export declare function websocketErrorWithOriginal(original: Error): RTMWebsocketError;
/**
 * A factory to create RTMPlatformError objects.
 */
export declare function platformErrorFromEvent(event: RTMCallResult & {
    error: {
        msg: string;
    };
}): RTMPlatformError;
/**
 * A factory to create RTMNoReplyReceivedError objects.
 */
export declare function noReplyReceivedError(): RTMNoReplyReceivedError;
/**
 * A factory to create RTMSendWhileDisconnectedError objects.
 */
export declare function sendWhileDisconnectedError(): RTMSendWhileDisconnectedError;
/**
 * A factory to create RTMSendWhileNotReadyError objects.
 */
export declare function sendWhileNotReadyError(): RTMSendWhileNotReadyError;
//# sourceMappingURL=errors.d.ts.map