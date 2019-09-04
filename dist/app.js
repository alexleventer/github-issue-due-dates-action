"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github_1 = require("@actions/github");
const Octokit_1 = __importDefault(require("./Octokit"));
const dateUtils_1 = require("./utils/dateUtils");
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const githubToken = core.getInput('GH_TOKEN');
        const ok = new Octokit_1.default(githubToken);
        const issues = yield ok.listAllOpenIssues(github_1.context.repo.owner, github_1.context.repo.repo);
        const results = yield ok.getIssuesWithDueDate(issues);
        results.forEach((issue) => __awaiter(void 0, void 0, void 0, function* () {
            const daysUtilDueDate = yield dateUtils_1.datesToDue(issue.due);
            if (daysUtilDueDate <= 7 && daysUtilDueDate > 0) {
                yield ok.addLabelToIssue(github_1.context.repo.owner, github_1.context.repo.repo, issue.number, ['Due in next week']);
            }
            else if (daysUtilDueDate <= 0) {
                yield ok.removeLabelFromIssue(github_1.context.repo.owner, github_1.context.repo.repo, 'Due in next week', issue.number);
                yield ok.addLabelToIssue(github_1.context.repo.owner, github_1.context.repo.repo, issue.number, ['Overdue']);
            }
        }));
    }
    catch (error) {
        core.setFailed(error.message);
    }
});
run();
