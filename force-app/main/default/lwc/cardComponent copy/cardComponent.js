//cardComponent.js
import { LightningElement, api, track } from "lwc";

export default class CardComponent extends LightningElement {
  @api title = "Custom Card Component";
  @api message = "Hello from Lightning Out!";
  @track messages = [];
  @track messageCounter = 0;

  connectedCallback() {
    // Listen for messages from the host page
    this.addEventListener("sendMessageToLWC", this.handleMessageFromHost);
  }

  disconnectedCallback() {
    // Clean up event listeners
    this.removeEventListener("sendMessageToLWC", this.handleMessageFromHost);
  }

  handleMessageFromHost = (event) => {
    console.log("DEBUG: Message received from host page in cardComponent:", event.detail);

    // Add message to our list
    this.messageCounter++;
    const newMessage = {
      id: this.messageCounter,
      text: event.detail.message,
      timestamp: event.detail.timestamp,
      source: event.detail.source,
    };

    this.messages = [...this.messages, newMessage];
    console.log("DEBUG: Message added to list in cardComponent, total messages:", this.messages.length);
  };

  handleSendMessage() {
    console.log("Sending message to host page from cardComponent...");

    const newMessage = `Message from LWC at ${new Date().toLocaleTimeString()}`;

    const hostEvent = new CustomEvent("lwcMessageToHost", {
      detail: {
        message: newMessage,
        timestamp: new Date().toISOString(),
        component: "c-card-component",
      },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(hostEvent);
    console.log("Message sent to host page from cardComponent");
  }
}
