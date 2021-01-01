'use strict';

const Dotenv = require('dotenv');
Dotenv.config();

const Protocol = require('azure-iot-device-http').Http;
const Client = require('azure-iot-device').Client;
const Message = require('azure-iot-device').Message;
const AirPurifier = require('miio/lib/devices/air-purifier');
const miio = require('miio');
const PurifierToken = process.env.TOKEN;
const deviceConnectionString = process.env.AZURE_IOT_DEVICE_CONNECTION_STRING;
const client = Client.fromConnectionString(deviceConnectionString, Protocol);
const messageObj = function (temp, rh, aqi) {
    this.temp = temp;
    this.rh = rh;
    this.aqi = aqi;
};
const ONE_SECOND = 1;
const ONE_MILLI_SECOND = 1000;
const ONE_SECOND_MS = ONE_SECOND * ONE_MILLI_SECOND;
let sendInterval;
let device;

Initilize();

function InitilizePurifier() {
    return new Promise(async (res, rej) => {
        try {
            miio.models['zhimi.airpurifier.mc1'] = AirPurifier;
            let ipArray = await getMiDeviceIpAddress(ONE_SECOND * 30);
            let devices = [];
            for (const ip of ipArray) {
                devices.push(await connectToDevice(ip, PurifierToken));
            }
            res(devices[0]);
        } catch (err) {
            rej(err);
        }
    });
}

async function getMiDeviceIpAddress(timeout) {
    let ipArray = [];
    return new Promise((resolve) => {
        const devices = miio.devices();
        devices.on('available', device => {
            console.log('Found miio device at IP - ' + device.address);
            ipArray.push(device.address);
            // Assuming only 1 miio device is there and resolving quickly.
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

function disconnectHandler() {
    clearInterval(sendInterval);
    client.open().catch((err) => {
        console.error(err.message);
    });
}

function messageHandler(msg) {
    console.log('Id: ' + msg.messageId + ' Body: ' + msg.data);
    client.complete(msg, printResultFor('completed'));
}

async function generateMessage() {
    return new Promise(async (res, rej) => {
        try {
            let data = new messageObj();
            if (device.matches('type:air-purifier')) {
                console.log('Air purifier on:', await device.power());
                console.log('Mode:', await device.mode());
                const temp = await device.temperature();
                data.temp = temp.celsius;
                data.rh = await device.relativeHumidity();
                data.aqi = await device.pm2_5();
            }
            res(new Message(JSON.stringify(data)));

        } catch (err) {
            rej(err);
        }
    });
}

function errorCallback(err) {
    console.error(err.message);
}

function connectCallback() {
    console.log('Client connected');
    // Create a message and send it to the IoT Hub every 60 seconds
    sendInterval = setInterval(async () => {
        const message = await generateMessage();
        console.log('Sending message: ' + message.getData());
        client.sendEvent(message, printResultFor('send'));
    }, 60 * ONE_SECOND_MS);

}


function printResultFor(op) {
    // Helper function to print results in the console
    return function printResult(err, res) {
        if (err) console.log(op + ' error: ' + err.toString());
        if (res) console.log(op + ' status: ' + res.constructor.name);
    };
}


async function Initilize() {
    device = await InitilizePurifier();
    client.on('connect', connectCallback);
    client.on('error', errorCallback);
    client.on('disconnect', disconnectHandler);
    client.on('message', messageHandler);
    client.open()
        .catch(err => {
            console.error('Could not connect: ' + err.message);
        });
}