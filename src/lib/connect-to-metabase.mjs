import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(process.cwd(), '.env');

let tokenCache = {
    token: null,
    expiry: null
};

const reloadEnv = () => {
    delete process.env.TOKEN;
    delete process.env.TOKEN_EXPIRY;

    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    Object.keys(envConfig).forEach(key => {
        process.env[key] = envConfig[key];
    });
};

const saveTokenToEnv = (token) => {
    const expiry = new Date(Date.now() + (13 * 24 * 60 * 60 * 1000)); // 13 days from now
    const expiryISO = expiry.toISOString();

    try {
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        const lines = envContent.split('\n').filter(line =>
            !line.startsWith('TOKEN=') &&
            !line.startsWith('TOKEN_EXPIRY=') &&
            line.trim() !== ''
        );

        lines.push(`TOKEN=${token}`);
        lines.push(`TOKEN_EXPIRY=${expiryISO}`);

        fs.writeFileSync(envPath, lines.join('\n') + '\n');

        // Update cache
        tokenCache.token = token;
        tokenCache.expiry = expiry;

        reloadEnv();

        console.log('✅ Token saved to .env successfully');
        console.log(`🕒 Token expires at: ${expiryISO}`);

    } catch (error) {
        console.error('❌ Failed to save token to .env:', error.message);
        throw error;
    }
};

const isTokenValid = () => {
    // Check cache first
    if (tokenCache.token && tokenCache.expiry && new Date() < tokenCache.expiry) {
        return true;
    }

    // Check from environment
    const token = process.env.TOKEN;
    const tokenExpiry = process.env.TOKEN_EXPIRY;

    if (!token || !tokenExpiry) {
        return false;
    }

    const expiryDate = new Date(tokenExpiry);
    const isValid = new Date() < expiryDate;

    if (isValid) {
        // Update cache
        tokenCache.token = token;
        tokenCache.expiry = expiryDate;
    }

    return isValid;
};

const getValidToken = async () => {
    // Return cached token if valid
    if (tokenCache.token && tokenCache.expiry && new Date() < tokenCache.expiry) {
        console.log('🔄 Using cached token');
        return tokenCache.token;
    }

    if (isTokenValid()) {
        console.log('🔄 Using existing valid token from .env');
        return process.env.TOKEN;
    }

    console.log('🔑 Generating new token...');
    const baseurl = process.env.BASE_URL;
    const username = process.env.USERNAME;
    const password = process.env.PASSWORD;

    const newToken = await generateMetabaseToken(baseurl, username, password);
    saveTokenToEnv(newToken);

    return newToken;
};

const getAuthMetabase = async () => {
    const baseurl = process.env.BASE_URL;
    const token = await getValidToken();

    return {
        baseUrl: baseurl,
        token: token
    };
};

const generateMetabaseToken = async (baseurl, username, password) => {
    const url = `${baseurl}api/session`;
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username,
            password
        })
    };

    try {
        console.log('🔐 Authenticating with Metabase...');
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const json = await response.json();
        console.log('✅ Successfully generated new Metabase token');
        return json.id;
    } catch (e) {
        console.error(`❌ Failed to generate token: ${e.message}`);
        throw e;
    }
};

export const retrieveQuestionMetabase = async (question_id) => {
    try {
        const auth = await getAuthMetabase();
        const baseurl = auth.baseUrl;
        const token = auth.token;

        const url = `${baseurl}api/card/${question_id}/query/csv`;
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Metabase-Session': token
            }
        };

        console.log(`📊 Fetching data from Metabase question ID: ${question_id}`);
        const response = await fetch(url, options);

        if (!response.ok) {
            // If token expired, try to regenerate once
            if (response.status === 401) {
                console.log('🔄 Token might be expired, regenerating...');

                // Clear cache and regenerate
                tokenCache.token = null;
                tokenCache.expiry = null;

                const newAuth = await getAuthMetabase();
                const retryOptions = {
                    ...options,
                    headers: {
                        ...options.headers,
                        'X-Metabase-Session': newAuth.token
                    }
                };

                const retryResponse = await fetch(url, retryOptions);
                if (!retryResponse.ok) {
                    throw new Error(`HTTP error after retry! status: ${retryResponse.status}`);
                }

                const data = await retryResponse.text();
                console.log(`✅ Data fetched successfully from Metabase (${data.length} characters)`);
                return data;
            }

            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.text();
        console.log(`✅ Data fetched successfully from Metabase (${data.length} characters)`);
        console.log(`📝 Sample data: ${data.slice(0, 100)}...`);
        return data;

    } catch (e) {
        console.error(`❌ Failed to fetch data: ${e.message}`);
        throw e;
    }
};

export const checkTokenStatus = async () => {
    console.log('🔍 Checking token status...');

    const token = process.env.TOKEN;
    const tokenExpiry = process.env.TOKEN_EXPIRY;

    if (!token) {
        console.log('❌ No token found in .env');
        return;
    }

    if (!tokenExpiry) {
        console.log('⚠️ Token found but no expiry date');
        return;
    }

    const expiryDate = new Date(tokenExpiry);
    const now = new Date();
    const timeLeft = expiryDate - now;
    const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (timeLeft > 0) {
        console.log(`✅ Token is valid. Expires in ${daysLeft} days, ${hoursLeft} hours`);
        console.log(`🕒 Expiry: ${expiryDate.toLocaleString()}`);
    } else {
        console.log(`❌ Token has expired ${Math.abs(daysLeft)} days ago`);
        console.log(`🕒 Expired: ${expiryDate.toLocaleString()}`);
    }
};