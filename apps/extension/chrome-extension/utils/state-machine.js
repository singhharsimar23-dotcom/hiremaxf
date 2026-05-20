// utils/state-machine.js
// Persistent Finite State Machine for Multi-Step Forms

window.HireMaxFSM = {
    STATES: {
        IDLE: 'IDLE',
        SCANNING: 'SCANNING',
        FIELD_MATCHING: 'FIELD_MATCHING',
        DRY_RUN: 'DRY_RUN',
        FILLING: 'FILLING',
        WAITING_FOR_NEXT_PAGE: 'WAITING_FOR_NEXT_PAGE',
        VALIDATION_CHECK: 'VALIDATION_CHECK',
        FIELD_VERIFICATION: 'FIELD_VERIFICATION',
        UPLOAD_CONFIRMATION: 'UPLOAD_CONFIRMATION',
        COMPLETE: 'COMPLETE',
        FAILED: 'FAILED',
        SAFE_ABORT: 'SAFE_ABORT'
    },

    getCurrentState: async function () {
        return new Promise((resolve) => {
            if (chrome.storage && chrome.storage.session) {
                chrome.storage.session.get(['hiremax_fsm_state'], (result) => {
                    resolve((result && result.hiremax_fsm_state) || this.STATES.IDLE);
                });
            } else {
                // Fallback for older chromes or contexts without session storage
                resolve(sessionStorage.getItem('hiremax_fsm_state') || this.STATES.IDLE);
            }
        });
    },

    transition: async function (newState, executionId = null) {
        if (!Object.keys(this.STATES).includes(newState)) {
            console.error(`[HireMax FSM] Invalid state transition to ${newState}`);
            return;
        }

        console.log(`[HireMax FSM] Transitioning to ${newState}`);

        if (chrome.storage && chrome.storage.session) {
            await chrome.storage.session.set({ 'hiremax_fsm_state': newState });
            if (executionId) {
                await chrome.storage.session.set({ 'hiremax_execution_id': executionId });
            }
        } else {
            sessionStorage.setItem('hiremax_fsm_state', newState);
            if (executionId) {
                sessionStorage.setItem('hiremax_execution_id', executionId);
            }
        }

        // Notify UI overlay
        chrome.runtime.sendMessage({
            type: "UI_UPDATE",
            payload: { type: "FSM_STATE_CHANGED", state: newState }
        });
    },

    reset: async function () {
        if (chrome.storage && chrome.storage.session) {
            await chrome.storage.session.remove(['hiremax_fsm_state', 'hiremax_execution_id']);
        } else {
            sessionStorage.removeItem('hiremax_fsm_state');
            sessionStorage.removeItem('hiremax_execution_id');
        }
    },

    getExecutionId: async function () {
        return new Promise((resolve) => {
            if (chrome.storage && chrome.storage.session) {
                chrome.storage.session.get(['hiremax_execution_id'], (result) => {
                    resolve(result.hiremax_execution_id || null);
                });
            } else {
                resolve(sessionStorage.getItem('hiremax_execution_id') || null);
            }
        });
    }
};
