import { LightningElement, track } from 'lwc';

export default class BridgeComponent extends LightningElement {
    @track messageFromHost = 'まだメッセージはありません';

    connectedCallback() {
        // 外部サイトから発火されたイベントをリッスンする [1]
        // Lightning Out 2.0ではイベントがミラーリングされるため、自身のイベントとして登録します
        this.addEventListener('messageFromExternal', this.handleMessageFromExternal);
    }

    // 外部サイトからのイベントを処理するハンドラ
    handleMessageFromExternal = (event) => {
        console.log('Received in LWC:', event.detail);
        this.messageFromHost = event.detail.message;
    };

    // 外部サイトへイベントを送信するハンドラ
    handleSendToHost() {
        // Shadow DOMの境界を超えるため、bubblesとcomposedをtrueにする必要があります [2]
        const event = new CustomEvent('messageFromLwc', {
            detail: {
                message: 'こんにちは！Salesforceからのメッセージです。',
                timestamp: new Date().toISOString()
            },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }
}