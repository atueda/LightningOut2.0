const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const crypto = require('crypto');
const axios = require('axios');

// Load environment variables
require('dotenv').config();

// PKCE helper functions
function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(codeVerifier) {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Updated CSP for Lightning Out 2.0
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "*.force.com", "*.salesforce.com", "*.my.salesforce.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "*.force.com", "*.salesforce.com", "*.my.salesforce.com"],
            frameSrc: ["'self'", "*.force.com", "*.salesforce.com", "*.my.salesforce.com"],
            connectSrc: ["'self'", "*.force.com", "*.salesforce.com", "*.my.salesforce.com"],
            imgSrc: ["'self'", "data:", "*.force.com", "*.salesforce.com", "*.my.salesforce.com"],
            fontSrc: ["'self'", "*.force.com", "*.salesforce.com", "*.my.salesforce.com"],
            childSrc: ["'self'", "*.force.com", "*.salesforce.com", "*.my.salesforce.com"]
        }
    }
}));

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Allow localhost and Salesforce domains for Lightning Out 2.0
        if (origin.includes('localhost') ||
            origin.includes('127.0.0.1') ||
            origin.includes('force.com') ||
            origin.includes('salesforce.com') ||
            origin.includes('my.salesforce.com')) {
            return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// OAuth 2.0 configuration
const OAUTH_CONFIG = {
    clientId: process.env.SALESFORCE_CLIENT_ID || 'YOUR_CONNECTED_APP_CLIENT_ID',
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || 'YOUR_CONNECTED_APP_CLIENT_SECRET',
    redirectUri: process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback',
    loginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com',
    domain: process.env.SALESFORCE_DOMAIN || 'storm-f1b2bd8ede67bc.my.salesforce.com',
    // Preferred org type endpoint override for password flow
    // If SALESFORCE_USERNAME ends with .sandbox or you set SALESFORCE_IS_SANDBOX=true,
    // we will use https://test.salesforce.com automatically
    isSandbox: (process.env.SALESFORCE_IS_SANDBOX || '').toLowerCase() === 'true'
};

const LIGHTNING_OUT_CONFIG = {
    appId: process.env.SALESFORCE_APP_ID || '1UsHu000000oQTeKAM',
    componentName: process.env.SALESFORCE_COMPONENT_NAME || 'c-card-component',
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
};

// Debug OAuth configuration
console.log('OAuth Configuration:');
console.log('Client ID:', OAUTH_CONFIG.clientId ? OAUTH_CONFIG.clientId.substring(0, 10) + '...' : 'NOT_SET');
console.log('Client Secret:', OAUTH_CONFIG.clientSecret ? 'SET (' + OAUTH_CONFIG.clientSecret.length + ' chars)' : 'NOT_SET');
console.log('Redirect URI:', OAUTH_CONFIG.redirectUri);
console.log('Login URL:', OAUTH_CONFIG.loginUrl);
console.log('Domain:', OAUTH_CONFIG.domain);

// Global token cache for server-to-server authentication
let tokenCache = null;

/**
 * Get cached access token or fetch new one
 * - Implements caching similar to Ruby @token_data pattern
 * - Enhanced error handling and logging
 */
async function getAccessToken() {
    // Return cached token if available
    if (tokenCache) {
        return tokenCache;
    }

    try {
        // Determine the correct Salesforce host
        const salesforceHost = process.env.SALESFORCE_HOST ||
                              (OAUTH_CONFIG.domain && !OAUTH_CONFIG.domain.includes('login.salesforce.com')
                                  ? OAUTH_CONFIG.domain
                                  : 'login.salesforce.com');

        const tokenUrl = `https://${salesforceHost}/services/oauth2/token`;

        // If user has opted into username-password flow exclusively, skip client_credentials
        const forcePassword = (process.env.SALESFORCE_AUTH_FLOW || '').toLowerCase() === 'password';

        const params = new URLSearchParams(
            forcePassword
                ? {
                    grant_type: 'password',
                    client_id: OAUTH_CONFIG.clientId,
                    client_secret: OAUTH_CONFIG.clientSecret,
                    username: process.env.SALESFORCE_USERNAME || '',
                    password: `${process.env.SALESFORCE_PASSWORD || ''}${process.env.SALESFORCE_SECURITY_TOKEN || ''}`
                  }
                : {
                    grant_type: 'client_credentials',
                    client_id: OAUTH_CONFIG.clientId,
                    client_secret: OAUTH_CONFIG.clientSecret
                  }
        );

        console.log('Attempting Salesforce authentication...');
        console.log('Token URL:', tokenUrl);
        console.log('Client ID:', OAUTH_CONFIG.clientId ? OAUTH_CONFIG.clientId.substring(0, 10) + '...' : 'NOT_SET');

        const response = await axios.post(tokenUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'User-Agent': 'LightningOut-Demo/2.0'
            },
            validateStatus: () => true // we will handle non-200 to surface clear errors
        });

        if (response.status === 200) {
            tokenCache = response.data;
            console.log(`Salesforce認証成功: ${tokenCache.instance_url}`);
            return tokenCache;
        } else {
            // Provide clearer diagnostics for password flow 400s
            const data = response.data || {};
            const errMsg = data.error_description || data.error || `HTTP ${response.status}`;
            console.error(`Salesforce認証失敗: ${response.status} - ${JSON.stringify(response.data)}`);
            throw new Error(errMsg);
        }

    } catch (error) {
        console.error(`Salesforce認証エラー: ${error.message}`);

        // Enhanced error logging similar to Ruby version
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        } else if (error.request) {
            console.error('No response received:', error.code || 'Unknown network error');
        }

        return null;
    }
}

/**
 * Create Restforce-like client configuration
 * - Mimics Ruby Restforce.new pattern
 * - Returns configuration object for API calls
 */
function createRestforceClient(tokenData) {
    if (!tokenData) {
        throw new Error('Token data is required');
    }

    return {
        oauth_token: tokenData.access_token,
        instance_url: tokenData.instance_url,
        api_version: '61.0',
        ssl: { verify: true },

        // Helper method for making authenticated API calls
        request: async function(endpoint, options = {}) {
            const url = `${this.instance_url}${endpoint}`;
            const config = {
                ...options,
                headers: {
                    'Authorization': `Bearer ${this.oauth_token}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            };

            return axios(url, config);
        }
    };
}

/**
 * Server-to-server authentication using Client Credentials Flow
 * - Enhanced with Ruby-inspired error handling and caching
 * - Uses getAccessToken() for token management
 */
async function authenticateServerToServer() {
    const tokenData = await getAccessToken();

    if (!tokenData) {
        throw new Error('Failed to obtain access token');
    }

    if (tokenData.error) {
        throw new Error(`Server auth error: ${tokenData.error_description || tokenData.error}`);
    }

    console.log('Server-to-server authentication successful');
    return {
        accessToken: tokenData.access_token,
        instanceUrl: tokenData.instance_url,
        tokenType: tokenData.token_type || 'Bearer',
        issuedAt: tokenData.issued_at,
        signature: tokenData.signature,
        serverAuth: true,
        // Include Restforce-like client for API calls
        client: createRestforceClient(tokenData)
    };
}

/**
 * Alternative authentication using Username/Password flow
 * (For testing when Client Credentials is not available)
 */
async function authenticateUsernamePassword() {
    try {
        // This is the explicit Username/Password method - requires username/password in environment
        const username = process.env.SALESFORCE_USERNAME;
        const password = process.env.SALESFORCE_PASSWORD;
        const securityToken = process.env.SALESFORCE_SECURITY_TOKEN || '';

        if (!username || !password) {
            throw new Error('Username/Password authentication requires SALESFORCE_USERNAME and SALESFORCE_PASSWORD environment variables');
        }

        // Determine correct endpoint: login (prod) or test (sandbox)
        const isSandboxByUsername = (username || '').toLowerCase().includes('.sandbox');
        const baseAuthUrl = (OAUTH_CONFIG.isSandbox || isSandboxByUsername)
            ? 'https://test.salesforce.com'
            : (process.env.SALESFORCE_LOGIN_URL || OAUTH_CONFIG.loginUrl);

        const params = new URLSearchParams({
            grant_type: 'password',
            client_id: OAUTH_CONFIG.clientId,
            client_secret: OAUTH_CONFIG.clientSecret,
            username: username,
            password: password + securityToken
        });

        console.log('Attempting username/password authentication...');
        console.log('Auth Host:', baseAuthUrl);
        console.log('Username suffix indicates sandbox:', isSandboxByUsername);

        const tokenResponse = await axios.post(`${baseAuthUrl}/services/oauth2/token`, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'User-Agent': 'LightningOut-Demo/1.0'
            },
            validateStatus: () => true
        });

        if (tokenResponse.status !== 200) {
            const data = tokenResponse.data || {};
            const errMsg = data.error_description || data.error || `HTTP ${tokenResponse.status}`;
            throw new Error(errMsg);
        }

        const tokenData = tokenResponse.data;
        console.log('Username/password authentication successful');

        return {
            accessToken: tokenData.access_token,
            instanceUrl: tokenData.instance_url,
            refreshToken: tokenData.refresh_token,
            tokenType: tokenData.token_type,
            issuedAt: tokenData.issued_at,
            signature: tokenData.signature,
            serverAuth: true,
            authMethod: 'password'
        };

    } catch (error) {
        console.error('Username/password authentication failed:', error?.response?.data || error.message);
        // Surface clearer guidance in error
        const hints = [
            '確認事項: Connected App のOAuth設定で「有効なOAuth設定」をONにし、必要なスコープを追加しているか',
            'ユーザーのパスワード+セキュリティトークンを連結しているか（IP制限を緩和していない場合）',
            'Sandboxの場合は test.salesforce.com のエンドポイントを使用しているか',
            'Consumer Key/Secret が正しいか、または流出防止のために再生成していないか'
        ];
        error.hints = hints;
        throw error;
    }
}

/**
 * Server authentication endpoint for direct token access
 */
app.post('/auth/server', async (req, res) => {
    let serverAuthData = null;
    let authType = 'unknown';

    try {
        // Respect explicit flow selection via env
        const forcePassword = (process.env.SALESFORCE_AUTH_FLOW || '').toLowerCase() === 'password';

        if (forcePassword) {
            // Directly use Username/Password flow
            try {
                serverAuthData = await authenticateUsernamePassword();
                authType = 'password';
                console.log('Username/Password authentication successful');
            } catch (passwordError) {
                console.error('Username/Password authentication failed');
                return res.status(401).json({
                    success: false,
                    error: 'Authentication failed',
                    details: {
                        usernamePassword: passwordError.message,
                        hints: passwordError.hints || []
                    },
                    solutions: [
                        'SALESFORCE_USERNAME と SALESFORCE_PASSWORD を設定（必要なら SECURITY_TOKEN も）',
                        'Sandbox の場合は SALESFORCE_IS_SANDBOX=true を設定、または SALESFORCE_LOGIN_URL を https://test.salesforce.com に変更',
                        'Connected App の OAuth 設定とスコープを再確認'
                    ]
                });
            }
        } else {
            // Try Client Credentials first, then fallback
            try {
                serverAuthData = await authenticateServerToServer();
                authType = 'client_credentials';
                console.log('Client Credentials authentication successful');
            } catch (clientCredError) {
                console.log('Client Credentials failed, trying username/password fallback');

                // Fallback to Username/Password flow
                try {
                    serverAuthData = await authenticateUsernamePassword();
                    authType = 'password';
                    console.log('Username/Password authentication successful');
                } catch (passwordError) {
                    // Both methods failed
                    console.error('All authentication methods failed');
                    console.error('Client Credentials error:', clientCredError.message);
                    console.error('Username/Password error:', passwordError.message);

                    return res.status(401).json({
                        success: false,
                        error: 'Authentication failed',
                        details: {
                            clientCredentials: clientCredError.message,
                            usernamePassword: passwordError.message,
                            hints: passwordError.hints || []
                        },
                        solutions: [
                            'Enable Client Credentials Flow in your Connected App',
                            'Set SALESFORCE_USERNAME and SALESFORCE_PASSWORD environment variables (+ SECURITY_TOKEN if needed)',
                            'Use https://test.salesforce.com for sandboxes or set SALESFORCE_IS_SANDBOX=true'
                        ]
                    });
                }
            }
        }

        // Generate Lightning Out URLs for server authentication
        const lightningReturnUrl = `/lightning/n/${LIGHTNING_OUT_CONFIG.componentName}`;
        const frontdoorUrl = `${serverAuthData.instanceUrl}/secur/frontdoor.jsp?sid=${serverAuthData.accessToken}&retURL=${encodeURIComponent(lightningReturnUrl)}`;

        // Store server auth in session
        req.session = req.session || {};
        req.session.salesforceAuth = {
            accessToken: serverAuthData.accessToken,
            refreshToken: serverAuthData.refreshToken,
            instanceUrl: serverAuthData.instanceUrl,
            tokenType: serverAuthData.tokenType,
            issuedAt: serverAuthData.issuedAt,
            signature: serverAuthData.signature,
            frontdoorUrl,
            sessionId: serverAuthData.accessToken,
            serverUrl: serverAuthData.instanceUrl,
            serverAuth: true,
            authMethod: serverAuthData.authMethod || authType,
            userId: null,
            orgId: null,
            userName: `Server Authentication (${authType})`,
            client: serverAuthData.client // Include the Restforce-like client
        };

        console.log('Server authentication stored in session');

        res.json({
            success: true,
            message: `Server authentication successful using ${authType}`,
            authType: authType,
            instanceUrl: serverAuthData.instanceUrl,
            frontdoorUrl: frontdoorUrl
        });

    } catch (error) {
        console.error('Unexpected server authentication error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Unexpected server authentication error',
            details: error.message
        });
    }
});

/**
 * OAuth login endpoint with PKCE (and fallback option)
 * - Mirrors "Step 1: 認証URLにリダイレクト" 要件
 * - Supports explicit query overrides: client_id, redirect_uri, domain
 */
app.get('/auth', (req, res) => {
    const usePKCE = req.query.pkce !== 'false'; // Default to PKCE, unless explicitly disabled

    if (usePKCE) {
        // Generate PKCE parameters
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);

        // Store code verifier in session for later use in callback
        req.session.codeVerifier = codeVerifier;
        req.session.usePKCE = true;

        const authUrl = `${OAUTH_CONFIG.loginUrl}/services/oauth2/authorize?` +
            `response_type=code&` +
            `client_id=${OAUTH_CONFIG.clientId}&` +
            `redirect_uri=${encodeURIComponent(OAUTH_CONFIG.redirectUri)}&` +
            `scope=web%20id&` +
            `code_challenge=${codeChallenge}&` +
            `code_challenge_method=S256`;

        console.log('Generated PKCE parameters:', {
            codeVerifier: codeVerifier.substring(0, 10) + '...',
            codeChallenge: codeChallenge.substring(0, 10) + '...',
            codeChallengeMethod: 'S256'
        });
        console.log('Redirecting to Salesforce OAuth with PKCE:', authUrl);

        res.redirect(authUrl);
    } else {
        // Fallback without PKCE for troubleshooting
        req.session.usePKCE = false;

        const authUrl = `${OAUTH_CONFIG.loginUrl}/services/oauth2/authorize?` +
            `response_type=code&` +
            `client_id=${OAUTH_CONFIG.clientId}&` +
            `redirect_uri=${encodeURIComponent(OAUTH_CONFIG.redirectUri)}&` +
            `scope=web%20id`;

        console.log('Redirecting to Salesforce OAuth WITHOUT PKCE (fallback mode):', authUrl);
        res.redirect(authUrl);
    }
});

/**
 * OAuth callback endpoint (Web Server Flow)
 * - Exchanges authorization code for tokens using axios (per feedback)
 * - PKCE and non-PKCE are both supported based on session flag
 */
app.get('/callback', async (req, res) => {
    console.log('OAuth callback received');
    console.log('Query parameters:', req.query);
    console.log('Full URL:', req.url);

    const authCode = req.query.code;
    const error = req.query.error;
    const errorDescription = req.query.error_description;

    // Error from IdP
    if (error) {
        console.error('OAuth error from Salesforce:', { error, error_description: errorDescription });
        const errorParams = new URLSearchParams({
            auth_error: error,
            error_description: errorDescription || 'Unknown OAuth error'
        });
        return res.redirect(`/?${errorParams.toString()}`);
    }

    if (!authCode) {
        console.error('No authorization code in callback');
        const errorParams = new URLSearchParams({
            auth_error: 'authorization_code_missing',
            error_description: 'Authorization code not provided in callback URL'
        });
        return res.redirect(`/?${errorParams.toString()}`);
    }

    console.log('Authorization code received:', authCode.substring(0, 20) + '...');

    // Determine if PKCE was used
    const usedPKCE = req.session && req.session.usePKCE !== false;

    try {
        // Build token params
        const params = {
            grant_type: 'authorization_code',
            code: authCode,
            client_id: OAUTH_CONFIG.clientId,
            redirect_uri: OAUTH_CONFIG.redirectUri
        };

        if (usedPKCE) {
            const codeVerifier = req.session.codeVerifier;
            if (!codeVerifier) {
                console.error('Code verifier not found in session');
                const errorParams = new URLSearchParams({
                    auth_error: 'session_error',
                    error_description: 'Code verifier not found in session. Please try authentication again.'
                });
                return res.redirect(`/?${errorParams.toString()}`);
            }
            params.code_verifier = codeVerifier;
        } else {
            // Non-PKCE requires client_secret
            params.client_secret = OAUTH_CONFIG.clientSecret;
        }

        // Exchange code for token via axios (application/x-www-form-urlencoded with query params)
        const tokenResponse = await axios.post(`${OAUTH_CONFIG.loginUrl}/services/oauth2/token`, null, { params });
        const tokenData = tokenResponse.data;

        if (tokenData.error) {
            console.error('OAuth error:', tokenData);
            return res.status(400).json({ error: tokenData.error_description || tokenData.error });
        }

        // Generate proper frontdoor URL for Lightning Out
        const lightningReturnUrl = `/lightning/n/${LIGHTNING_OUT_CONFIG.componentName}`;
        const frontdoorUrl = `${tokenData.instance_url}/secur/frontdoor.jsp?sid=${tokenData.access_token}&retURL=${encodeURIComponent(lightningReturnUrl)}`;

        // Alternative: Direct Lightning Out URL for iFrame embedding
        const lightningOutUrl = `${tokenData.instance_url}/lightning/o/${LIGHTNING_OUT_CONFIG.appId}`;

        // Save comprehensive auth data in session
        req.session = req.session || {};
        req.session.salesforceAuth = {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            instanceUrl: tokenData.instance_url,
            id: tokenData.id,
            issuedAt: tokenData.issued_at,
            signature: tokenData.signature,
            frontdoorUrl,
            lightningOutUrl,
            sessionId: tokenData.access_token, // SID for Lightning Out
            serverUrl: tokenData.instance_url,
            userId: null, // Will be populated from userinfo
            orgId: null   // Will be populated from userinfo
        };
        delete req.session.codeVerifier;

        // Fetch user information to populate user/org details
        try {
            const userInfoResponse = await axios.get(`${tokenData.instance_url}/services/oauth2/userinfo`, {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`
                }
            });

            const userInfo = userInfoResponse.data;
            req.session.salesforceAuth.userId = userInfo.user_id;
            req.session.salesforceAuth.orgId = userInfo.organization_id;
            req.session.salesforceAuth.userName = userInfo.name;
            req.session.salesforceAuth.userEmail = userInfo.email;

            console.log('User info fetched:', {
                userId: userInfo.user_id,
                orgId: userInfo.organization_id,
                name: userInfo.name
            });
        } catch (userInfoError) {
            console.warn('Failed to fetch user info:', userInfoError.response?.data || userInfoError.message);
        }

        console.log('Authentication successful');

        // Optional: debug redirect to include token in query (development only)
        if (process.env.NODE_ENV === 'development' && req.query.debug === 'true') {
            const redirectParams = new URLSearchParams({
                token: tokenData.access_token,
                instance: tokenData.instance_url
            });
            return res.redirect(`/?${redirectParams.toString()}`);
        }

        // Redirect to main page with token parameters for Lightning Out
        const redirectParams = new URLSearchParams({
            token: tokenData.access_token,
            instance: tokenData.instance_url
        });
        res.redirect(`/?${redirectParams.toString()}`);
    } catch (e) {
        console.error('OAuth callback error:', e?.response?.data || e.message || e);
        res.status(500).json({ error: 'Authentication failed', details: e?.response?.data || e.message });
    }
});

// Lightning Out 2.0 configuration endpoint
app.get('/api/lightning-config', async (req, res) => {
    const authData = req.session?.salesforceAuth;

    // If no session auth data, try server authentication to get fresh tokens
    let effectiveAuthData = authData;
    let serverAuthAttempted = false;

    if (!authData) {
        try {
            console.log('No session auth found, attempting server authentication...');
            const serverAuthResult = await authenticateServerToServer();
            serverAuthAttempted = true;

            // Generate Lightning Out URLs for server authentication
            const lightningReturnUrl = `/lightning/n/${LIGHTNING_OUT_CONFIG.componentName}`;
            const frontdoorUrl = `${serverAuthResult.instanceUrl}/secur/frontdoor.jsp?sid=${serverAuthResult.accessToken}&retURL=${encodeURIComponent(lightningReturnUrl)}`;

            effectiveAuthData = {
                accessToken: serverAuthResult.accessToken,
                instanceUrl: serverAuthResult.instanceUrl,
                frontdoorUrl,
                sessionId: serverAuthResult.accessToken,
                serverUrl: serverAuthResult.instanceUrl,
                serverAuth: true,
                authMethod: 'server_fallback',
                userName: 'Server Authentication (auto)',
                userId: null,
                orgId: null,
                client: serverAuthResult.client // Include the Restforce-like client
            };
        } catch (error) {
            console.warn('Server authentication fallback failed:', error.message);
            serverAuthAttempted = true;
        }
    }

    res.json({
        success: true,
        authenticated: !!effectiveAuthData,
        config: {
            // Lightning Out specific configuration
            lightningDomain: effectiveAuthData?.instanceUrl?.replace(/https?:\/\//, '') || OAUTH_CONFIG.domain,
            serverUrl: effectiveAuthData?.instanceUrl || `https://${OAUTH_CONFIG.domain}`,
            sessionId: effectiveAuthData?.sessionId || '',
            appId: LIGHTNING_OUT_CONFIG.appId,
            componentName: LIGHTNING_OUT_CONFIG.componentName,

            // Authentication URLs
            frontdoorUrl: effectiveAuthData?.frontdoorUrl || '',
            lightningOutUrl: effectiveAuthData?.lightningOutUrl || '',

            // User context
            userId: effectiveAuthData?.userId || '',
            orgId: effectiveAuthData?.orgId || '',
            userName: effectiveAuthData?.userName || '',

            // Security configuration
            allowedOrigins: [
                'http://localhost:3000',
                'http://localhost:8080',
                'http://127.0.0.1:3000',
                effectiveAuthData?.instanceUrl || `https://${OAUTH_CONFIG.domain}`,
                ...LIGHTNING_OUT_CONFIG.allowedOrigins
            ].filter(Boolean).map(origin => origin.replace(/\/$/, '')) // Remove trailing slashes
        },

        // Debug information (development only)
        debug: process.env.NODE_ENV === 'development' ? {
            sessionExists: !!req.session,
            authDataKeys: authData ? Object.keys(authData) : [],
            hasAccessToken: !!authData?.accessToken,
            serverAuthAttempted: serverAuthAttempted,
            usingServerFallback: !authData && !!effectiveAuthData
        } : undefined
    });
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        message: `Route ${req.originalUrl} not found`
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Lightning Out Demo Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to view the demo`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Messages API: http://localhost:${PORT}/api/messages`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

module.exports = app;