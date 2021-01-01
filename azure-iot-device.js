'use strict';

const Dotenv = require('dotenv');
const Protocol = require('azure-iot-device-http').Http;
const Client = require('azure-iot-device').Client;
const Message = require('azure-iot-device').Message;
const AirPurifier = require('miio/lib/devices/air-purifier');
const miio = require('miio');

const deviceConnectionString = process.env.AZURE_IOT_DEVICE_CONNECTION_STRING;
let sendInterval;

Dotenv.config();
Initilize();

async function InitilizePurifier() {
    miio.models['zhimi.airpurifier.mc1'] = AirPurifier;
    let ipArray = await getMiDeviceIpAddress(ONE_SECOND * 30);
    let devices = [];
    for (const ip of ipArray) {
        devices.push(await connectToDevice(ip, PurifierToken));
    }
    return devices[0];
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

async function logDeviceParameters(device) {
    if (device.matches('type:air-purifier')) {
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

function generateMessage() {
    const windSpeed = 10 + (Math.random() * 4); // range: [10, 14]
    const temperature = 20 + (Math.random() * 10); // range: [20, 30]
    const humidity = 60 + (Math.random() * 20); // range: [60, 80]
    const data = JSON.stringify({ deviceId: 'MiAirPurifier', windSpeed: windSpeed, temperature: temperature, humidity: humidity });
    const message = new Message(data);
    message.properties.add('temperatureAlert', (temperature > 28) ? 'true' : 'false');
    return message;
}

function errorCallback(err) {
    console.error(err.message);
}

function connectCallback() {
    console.log('Client connected');
    // Create a message and send it to the IoT Hub every two seconds
    sendInterval = setInterval(() => {
        const message = generateMessage();
        console.log('Sending message: ' + message.getData());
        client.sendEvent(message, printResultFor('send'));
    }, 2000);

}


function printResultFor(op) {
    // Helper function to print results in the console
    return function printResult(err, res) {
        if (err) console.log(op + ' error: ' + err.toString());
        if (res) console.log(op + ' status: ' + res.constructor.name);
    };
}


function Initilize() {
    const device = InitilizePurifier();
    let client = Client.fromConnectionString(deviceConnectionString, Protocol);

    client.on('connect', connectCallback);
    client.on('error', errorCallback);
    client.on('disconnect', disconnectHandler);
    client.on('message', messageHandler);

    client.open()
        .catch(err => {
            console.error('Could not connect: ' + err.message);
        });

}