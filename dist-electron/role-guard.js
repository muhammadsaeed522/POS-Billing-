"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWorkerRole = isWorkerRole;
exports.assertNotWorkerOrThrow = assertNotWorkerOrThrow;
const auth_ipc_1 = require("./auth-ipc");
function isWorkerRole() {
    return ((0, auth_ipc_1.getSession)()?.role ?? "").toLowerCase() === "worker";
}
/** Workers may use dashboard + POS only; block catalog and reports IPC. */
function assertNotWorkerOrThrow() {
    if (isWorkerRole()) {
        throw new Error("Your account does not have access to this area.");
    }
}
