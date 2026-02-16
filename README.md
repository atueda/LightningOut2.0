# Lightning Out 2.0 Demo

This project demonstrates Lightning Out 2.0 with bidirectional event communication between Lightning Web Components (LWC) and a Node.js host page.

## Features

- ⚡ Lightning Out 2.0 integration
- 🔄 Bidirectional event communication using `window.postMessage()`
- 🎯 LWC component with interactive features
- 🌐 Node.js Express server hosting the demo
- 📡 RESTful APIs for message handling
- 🔒 Security headers and CORS configuration
- 📱 Responsive design

## Project Structure

```
├── force-app/main/default/lwc/cardComponent/  # Lightning Web Component
│   ├── cardComponent.js                       # Component logic
│   ├── cardComponent.html                     # Component template
│   └── cardComponent.js-meta.xml             # Component metadata
├── public/
│   └── index.html                            # Host page with Lightning Out
├── server.js                                 # Node.js Express server
├── package.json                              # Dependencies and scripts
├── .env.example                              # Environment variables template
└── README.md                                 # This file
```

## Prerequisites

- Node.js 16+ and npm 8+
- Salesforce org with Lightning Out enabled
- Connected App configured in Salesforce

## Setup Instructions

### 1. Salesforce Configuration

1. **Deploy the Lightning Web Component:**
   ```bash
   sfdx force:source:push
   ```

2. **Create a Lightning Out App:**
   Create an Aura application (e.g., `LightningOutApp.app`):
   ```xml
   <aura:application access="GLOBAL" extends="ltng:outApp">
       <aura:dependency resource="c:cardComponent"/>
   </aura:application>
   ```

3. **Configure Connected App:**
   - Set up CORS for your domain (e.g., `http://localhost:3000`)
   - Enable Lightning Out in your org settings

### 2. Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and replace YOUR_SALESFORCE_DOMAIN with your actual domain
   ```

3. **Update the HTML file:**
   Replace `YOUR_SALESFORCE_DOMAIN` in `public/index.html` with your Salesforce domain.

4. **Start the server:**
   ```bash
   npm run server:dev  # Development with auto-reload
   # or
   npm run server      # Production mode
   ```

5. **Open the demo:**
   Navigate to `http://localhost:3000` in your browser.

## Event Communication Flow

### Lightning to Host
The LWC component sends messages to the host page using:
```javascript
window.parent.postMessage(messageData, '*');
```

### Host to Lightning
The host page sends messages to the Lightning component using:
```javascript
iframe.contentWindow.postMessage(messageData, '*');
```

## API Endpoints

- `GET /` - Serve the main demo page
- `GET /api/health` - Health check
- `GET /api/messages` - Get message history
- `POST /api/messages` - Store a new message
- `DELETE /api/messages` - Clear all messages
- `GET /api/lightning-config` - Get Lightning configuration
- `POST /api/webhook/salesforce` - Webhook endpoint for Salesforce events

## Component Features

- **Interactive Counter:** Click button to increment and send messages
- **Custom Messages:** Send custom text messages to host page
- **Message History:** View received messages from host
- **Reset Functionality:** Clear component state
- **Real-time Communication:** Instant bidirectional messaging

## Troubleshooting

### Common Issues

1. **"Lightning Out app not loading"**
   - Verify your Salesforce domain is correct
   - Check CORS settings in Salesforce
   - Ensure Lightning Out is enabled in your org

2. **"Messages not received"**
   - Check browser console for errors
   - Verify iframe is loaded properly
   - Confirm event listener setup

3. **"CORS errors"**
   - Add your local domain to Salesforce CORS settings
   - Check server CORS configuration

### Debug Mode

Set `NODE_ENV=development` in your `.env` file for detailed error messages.

## Resources

- [Lightning Out Documentation](https://developer.salesforce.com/docs/platform/lwc/guide/lightning-out.html)
- [Lightning Web Components Guide](https://developer.salesforce.com/docs/component-library/documentation/en/lwc)
- [Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_intro.htm)
# LightningOut2.0
