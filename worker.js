export default {
async fetch(request, env) {
if (request.method === 'POST') {
try {
const { score, deviceInfo } = await request.json();
if (!score || isNaN(score)) {
return new Response(JSON.stringify({ error: '無效的性能得分' }), {
status: confront: 400,
headers: { 'Content-Type': 'application/json' },
});
}

const newEntry = {
score: parseFloat(score),
deviceInfo: deviceInfo || '未知裝置',
timestamp: new Date().toISOString(),
};
await saveToKV(newEntry, env);

const allData = await getAllData(env);
const scores = allData.map(entry => entry.score);
const avgScore = scores.length ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
const medianScore = scores.length ? calculateMedian(scores) : 0;
const percentile = scores.length ? calculatePercentile(score, scores) : 0;
const groups = groupByDeviceType(allData);
const mobileAvg = groups.mobile.length ? (groups.mobile.reduce((sum, s) => sum + s, 0) / groups.mobile.length).toFixed(2) : '無數據';
const desktopAvg = groups.desktop.length ? (groups.desktop.reduce((sum, s) => sum + s, 0) / groups.desktop.length).toFixed(2) : '無數據';

const comparison = {
yourScore: parseFloat(score),
averageScore: avgScore.toFixed(2),
medianScore: medianScore.toFixed(2),
percentile: percentile,
mobileAverage: mobileAvg,
desktopAverage: desktopAvg,
message: score > avgScore ? '您的裝置性能高於平均！' : '您的裝置性能低於平均。',
totalDevices: allData.length,
};

return new Response(JSON.stringify(comparison), {
status: 200,
headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
});
} catch (error) {
return new Response(JSON.stringify({ error: '伺服器錯誤，請稍後再試' }), {
status: 500,
headers: { 'Content-Type': 'application/json' },
});
}
}
return new Response('Method not allowed', { status: 405 });
},
};

function calculateMedian(scores) {
const sorted = scores.sort((a, b) => a - b);
const mid = Math.floor(sorted.length / 2);
return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function calculatePercentile(score, scores) {
const sorted = scores.sort((a, b) => a - b);
const index = sorted.findIndex(s => s >= score);
return index === -1 ? 100 : ((index / sorted.length) * 100).toFixed(2);
}

function groupByDeviceType(data) {
const groups = { mobile: [], desktop: [], unknown: [] };
data.forEach(entry => {
const deviceInfo = JSON.parse(entry.deviceInfo || '{}');
const isMobile = deviceInfo.os === 'Android' || deviceInfo.os === 'iOS';
const group = isMobile ? 'mobile' : deviceInfo.os ? 'desktop' : 'unknown';
groups[group].push(entry.score);
});
return groups;
}

async function saveToKV(data, env) {
await cleanOldData(env);
const dateKey = `performance_data_${new Date().toISOString().split('T')[0]}`;
let dailyData = await env.KV_NAMESPACE.get(dateKey, { type: 'json' }) || [];
if (!Array.isArray(dailyData)) {
dailyData = [];
}
dailyData.push(data);
if (dailyData.length > 1000) {
dailyData.shift();
}
await env.KV_NAMESPACE.put(dateKey, JSON.stringify(dailyData));
return dailyData;
}

async function getAllData(env) {
const keys = await env.KV_NAMESPACE.list();
let allData = [];
for (const key of keys.keys) {
if (key.name.startsWith('performance_data_')) {
const data = await env.KV_NAMESPACE.get(key.name, { type: 'json' }) || [];
allData = allData.concat(data);
}
}
return allData;
}

async function cleanOldData(env) {
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const keys = await env.KV_NAMESPACE.list();
for (const key of keys.keys) {
if (key.name.startsWith('performance_data_') && key.name < `performance_data_${thirtyDaysAgo}`) {
await env.KV_NAMESPACE.delete(key.name);
}
}
}
