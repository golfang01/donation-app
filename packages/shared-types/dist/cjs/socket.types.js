"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCKET_EVENTS = void 0;
// Centralized event name constants — avoids typo bugs from
// hardcoding 'donation:verified' as a raw string in multiple places.
exports.SOCKET_EVENTS = {
    DONATION_VERIFIED: 'donation:verified',
};
