const dotenv = require('dotenv');
dotenv.config();

const AirPurifier = require('miio/lib/devices/air-purifier');
const miio = require('miio');


const ONE_SECOND = 1;
const ONE_MILLI_SECOND = 1000;
const ONE_SECOND_MS = ONE_SECOND * ONE_MILLI_SECOND;
const PurifierToken = process.env.TOKEN;


PatchMiioDeviceModel();
Initilize();

async function Initilize() {
    let ipArray = await getMiDeviceIpAddress(ONE_SECOND * 30);
    let devices = [];
    for (const ip of ipArray) {
        devices.push(await connectToDevice(ip, PurifierToken));
    }
    devices.forEach(device => {
        logDeviceParameters(device);
        setInterval(() => {
            logDeviceParameters(device);
        }, ONE_SECOND_MS * 60);
        device.on('pm2.5Changed', pm2_5 => {
            console.log('New AQI:' + pm2_5);
        });
    });
}

async function getMiDeviceIpAddress(timeout) {
    let ipArray = [];
    return new Promise((resolve) => {
        const devices = miio.devices();
        devices.on('available', device => {
            console.log('Found device - ' + device.address);
            ipArray.push(device.address);
            // Assuming only 1 miio device is there resolving quickly.
            resolve(ipArray);
        });
        setTimeout(function () {
            resolve(ipArray);
        }, timeout * ONE_MILLI_SECOND);
    });
}

function connectToDevice(address, token) {
    return new Promise((resolve, reject) => {
        miio.device({
            address, token
        }).then(device => {
            resolve(device);
        }).catch(err => {
            console.log(err);
            reject(err);
        });
    });
}

async function logDeviceParameters(device) {
    if (device.matches('type:air-purifier')) {
        console.log('\n');
        console.log('Air purifier on:', await device.power());
        console.log('Mode:', await device.mode());
        const temp = await device.temperature();
        console.log('Temperature:', temp.celsius);

        const rh = await device.relativeHumidity();
        console.log('Relative humidity:', rh);

        const aqi = await device.pm2_5();
        console.log('Air Quality Index:', aqi);
    }
}

function PatchMiioDeviceModel() {
    miio.models['zhimi.airpurifier.mc1'] = AirPurifier;
}