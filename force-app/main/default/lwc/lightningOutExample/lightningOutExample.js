import { LightningElement, api } from 'lwc';

const EVENT_VERSION = '1.0.0';
const SOURCE_LWC = 'lwc';
const TYPE_HOST_TO_LWC = 'host:request';
const TYPE_LWC_TO_HOST = 'lwc:response';
const ALLOWED_MESSAGE_TYPES = new Set([TYPE_HOST_TO_LWC, TYPE_LWC_TO_HOST]);

export default class LightningOutExample extends LightningElement {
    @api userName = 'Guest';
    message = '';

    connectedCallback() {
        // Listen CustomEvent from host page (DOM event path)
        this.template.addEventListener('sendMessageToLWC', this.handleHostDomEvent);

        // Listen postMessage from host page (window messaging)
        // Note: in Lightning Out, LWC runs in same window; keep origin validation for safety
        window.addEventListener('message', this.handleWindowMessage);
    }

    disconnectedCallback() {
        this.template.removeEventListener('sendMessageToLWC', this.handleHostDomEvent);
        window.removeEventListener('message', this.handleWindowMessage);
    }

    // Use arrow functions to preserve 'this'
    handleHostDomEvent = (evt) => {
        try {
            const { message, source, eventId } = evt.detail || {};
            this.message = `[DOM] ${message || 'No message'} (${source || 'unknown'}) @ ${new Date().toLocaleTimeString()}`;

            // Echo back to host as CustomEvent as well as postMessage for versatility
            this.fireDomMessage({
                message: `Received your DOM event: ${message || ''}`.trim(),
                from: SOURCE_LWC,
                userName: this.userName,
                originalEventId: eventId || null
            });

            this.postMessageToHost({
                type: TYPE_LWC_TO_HOST,
                payload: {
                    message: `Received your DOM event: ${message || ''}`.trim(),
                    from: SOURCE_LWC,
                    userName: this.userName,
                    originalEventId: eventId || null
                }
            });
        } catch (e) {
            // swallow errors
        }
    };

    handleWindowMessage = (evt) => {
        try {
            // Security: origin check. Default allow same origin. Adjust if you host on different domain.
            const allowedOrigin = window.location && window.location.origin ? window.location.origin : null;
            if (!allowedOrigin || evt.origin !== allowedOrigin) {
                return;
            }

            const data = evt.data;
            if (!data || typeof data !== 'object') return;

            // Basic schema validation
            const { type, payload, version } = data;
            if (!ALLOWED_MESSAGE_TYPES.has(type)) return;
            if (version && version !== EVENT_VERSION) {
                // Version mismatch; ignore for now
            }

            if (type === TYPE_HOST_TO_LWC) {
                const incomingMsg = (payload && payload.message) ? payload.message : '';
                this.message = `[postMessage] ${incomingMsg} @ ${new Date().toLocaleTimeString()}`;

                // Respond to host
                this.postMessageToHost({
                    type: TYPE_LWC_TO_HOST,
                    payload: {
                        message: `LWC processed: ${incomingMsg}`,
                        userName: this.userName,
                        processedAt: new Date().toISOString()
                    }
                });

                // Also raise a DOM event for pages listening via addEventListener on component
                this.fireDomMessage({
                    message: `Echo: ${incomingMsg}`,
                    component: 'lightningOutExample'
                });
            }
        } catch (e) {
            // No-op
        }
    };

    // Send structured message to host via window.postMessage
    postMessageToHost(detail) {
        try {
            const target = window.parent || window;
            const targetOrigin = (window.location && window.location.origin) ? window.location.origin : '*';
            const envelope = {
                type: (detail && detail.type) ? detail.type : TYPE_LWC_TO_HOST,
                version: EVENT_VERSION,
                source: SOURCE_LWC,
                payload: (detail && detail.payload) ? detail.payload : {},
                timestamp: new Date().toISOString()
            };
            target.postMessage(envelope, targetOrigin);
        } catch (e) {
            // swallow errors to avoid breaking UI
        }
    }

    // Dispatch CustomEvent for host page listeners
    fireDomMessage(detail) {
        const evt = new CustomEvent('lwcMessageToHost', {
            detail: {
                ...detail,
                component: 'lightningOutExample',
                timestamp: new Date().toISOString()
            },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(evt);
    }

    handleNameChange(event) {
        this.userName = event.target.value;
    }

    handleClick() {
        console.log("LWC button clicked in lightningOutExample component");
        this.message = `Button clicked by ${this.userName} at ${new Date().toLocaleTimeString()}`;

        // On click, notify host via both channels
        this.fireDomMessage({
            message: `Button clicked by ${this.userName}`
        });

        this.postMessageToHost({
            type: TYPE_LWC_TO_HOST,
            payload: {
                message: `Button clicked by ${this.userName}`,
                userName: this.userName
            }
        });
        console.log("LWC button click handled in lightningOutExample component");
    }
}
