'use strict';

const AWS = require('aws-sdk');
const ssm = new AWS.SSM();
const cloudWatch = new AWS.CloudWatch();

const token = ssm.getParameter({
  Name: process.env.TOKEN_PARAM,
  WithDecryption: true,
})
    .promise()
    .then((data) => data.Parameter.Value)
    .catch((err) => {
      console.error(err);
      return '';
    });

const axios = require('axios');

exports.handler = async (event) => {
  const devices = await axios.default.get('/devices', {
    baseURL: 'https://api.nature.global/1',
    headers: {
      Authorization: `Bearer ` + await token,
    },
  })
      .then((res) => res.data)
      .catch((err) => {
        console.error(err);
        return [];
      });
  if (devices.length === 0) return;

  const metricData = [];
  for (const device of devices) {
    if (!device.newest_events) continue;

    for (const [sensor, reading] of Object.entries(device.newest_events)) {
      metricData.push({
        MetricName: 'SensorReading',
        Dimensions: [
          {Name: 'Device', Value: device.name},
          {Name: 'Sensor', Value: sensor},
        ],
        Timestamp: new Date(reading.created_at),
        Value: reading.val,
      });
    }
  }
  if (metricData.length === 0) return;

  await cloudWatch.putMetricData({Namespace: 'Remo', MetricData: metricData})
      .promise()
      .catch(console.error);
};
