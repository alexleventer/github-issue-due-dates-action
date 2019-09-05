"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const moment_1 = __importDefault(require("moment"));
exports.datesToDue = (date) => {
    const eventDate = moment_1.default(date);
    const today = moment_1.default();
    return eventDate.diff(today, 'days');
};
