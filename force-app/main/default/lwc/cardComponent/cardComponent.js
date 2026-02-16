import { LightningElement, track } from 'lwc';

export default class CardComponent extends LightningElement {
    @track messagesFromHost = [];
    messageToHost = '';

    connectedCallback() {
        // ホストページからのイベントを受け取る
        this.template.addEventListener('sendMessageToLWC', this.handleMessageFromHost.bind(this));
    }

    handleInputChange(event) {
        this.messageToHost = event.target.value;
    }

    handleSendMessage() {
        const event = new CustomEvent('lwcMessageToHost', {
            detail: { message: this.messageToHost },
            bubbles: true,
            composed: true   // Lightning Out 2.0 では必須
        });
        this.dispatchEvent(event);
    }

    handleMessageFromHost(event) {
        const msg = event.detail && event.detail.message;
        if (msg) {
            this.messagesFromHost = [...this.messagesFromHost, msg];
        }
    }
}
