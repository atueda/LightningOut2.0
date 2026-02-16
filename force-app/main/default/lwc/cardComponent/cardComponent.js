import { LightningElement, track, api } from 'lwc';

export default class CardComponent extends LightningElement {
    @api title = 'LightningOut20 Custom App';
    @api message;
    @track messagesFromHost = [];
    messageToHost = '';

    connectedCallback() {
        // 初期化完了を表示
        console.log('LWC CardComponent initialized');

        // テスト用の初期メッセージを追加
        this.messagesFromHost = [{
            id: 'init-msg',
            text: 'LWC Component loaded successfully',
            timestamp: new Date().toLocaleTimeString()
        }];

        // ホストページからのイベントを受け取る - Lightning Out対応
        // this要素自体にイベントリスナーを設定
        this.addEventListener('sendMessageToLWC', this.handleMessageFromHost.bind(this));

        console.log('LWC: Event listener registered for sendMessageToLWC');
    }

    handleInputChange(event) {
        this.messageToHost = event.target.value;
    }

    handleSendMessage() {
        console.log('LWC: Send button clicked, message:', this.messageToHost);

        const event = new CustomEvent('lwcMessageToHost', {
            detail: { message: this.messageToHost || 'Test message from LWC' },
            bubbles: true,
            composed: true   // Lightning Out 2.0 では必須
        });

        console.log('LWC: Dispatching event to host:', event.detail);
        this.dispatchEvent(event);
    }

    handleMessageFromHost(event) {
        const msg = event.detail && event.detail.message;
        console.log('LWC: Received message from host:', msg);

        if (msg) {
            // オブジェクト形式でメッセージを追加（適切なkeyのため）
            const messageItem = {
                id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                text: msg,
                timestamp: new Date().toLocaleTimeString()
            };

            this.messagesFromHost = [...this.messagesFromHost, messageItem];
            console.log('LWC: Messages array updated:', this.messagesFromHost);
        }
    }
}