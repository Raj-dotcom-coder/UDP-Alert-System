const dgram = require("dgram");
const client = dgram.createSocket("udp4");


/*
====================================================
CONFIGURATION
====================================================
*/

const SERVER_IP = process.env.SERVER_IP || "192.168.50.1";
const SERVER_PORT = Number(process.env.SERVER_PORT || 41234);

// Give each device a unique ID
const DEVICE_ID = process.env.DEVICE_ID || "LAPTOP-DEVICE-01";
const DEVICE_NAME = process.env.DEVICE_NAME || "Laptop Device";

// Client UDP port
const CLIENT_PORT = Number(process.env.CLIENT_PORT || 41235);


/*
====================================================
SEND UDP MESSAGE
====================================================
*/

function sendMessage(data) {

  const message =
    Buffer.from(
      JSON.stringify(data)
    );


  client.send(
    message,
    0,
    message.length,
    SERVER_PORT,
    SERVER_IP,
    (error) => {

      if (error) {

        console.error(
          "UDP send error:",
          error.message
        );

      }

    }
  );

}


/*
====================================================
REGISTER DEVICE
====================================================
*/

function registerDevice() {

  sendMessage({

    type: "REGISTER",

    deviceId:
      DEVICE_ID,

    deviceName:
      DEVICE_NAME,

    port:
      CLIENT_PORT,

    timestamp:
      new Date().toISOString()

  });

}


/*
====================================================
HEARTBEAT
====================================================
*/

function sendHeartbeat() {

  sendMessage({

    type: "HEARTBEAT",

    deviceId:
      DEVICE_ID,

    timestamp:
      new Date().toISOString()

  });

}


/*
====================================================
RECEIVE UDP MESSAGE
====================================================
*/

client.on(
  "message",
  (message, remote) => {

    try {

      const data =
        JSON.parse(
          message.toString()
        );


      console.log("\n==============================");

      console.log(
        "UDP MESSAGE RECEIVED"
      );

      console.log(
        "From:",
        remote.address
      );

      console.log(
        data
      );

      console.log(
        "==============================\n"
      );


      /*
      ================================================
      REGISTRATION ACK
      ================================================
      */

      if (
        data.type ===
        "REGISTER_ACK"
      ) {

        console.log(
          data.message || `Device ${data.deviceName || DEVICE_NAME} registered with server.`
        );

        return;
      }


      /*
      ================================================
      EMERGENCY ALERT
      ================================================
      */

      if (
        data.type === "ALERT"
      ) {

        console.log(
          "\n🚨🚨🚨 EMERGENCY ALERT 🚨🚨🚨"
        );

        console.log(
          "Priority:",
          data.priority
        );

        console.log(
          "Title:",
          data.title
        );

        console.log(
          "Message:",
          data.message
        );

        console.log(
          "Alert ID:",
          data.alertId
        );

        console.log(
          "Time:",
          data.timestamp
        );


        /*
        Send acknowledgement
        */

        sendMessage({

          type: "ACK",

          alertId:
            data.alertId,

          deviceId:
            DEVICE_ID,

          timestamp:
            new Date().toISOString()

        });


        console.log(
          "✓ ACK sent to server."
        );

      }

    } catch (error) {

      console.error(
        "Invalid UDP packet:",
        error.message
      );

    }

  }
);


/*
====================================================
CLIENT START
====================================================
*/

client.bind(
  CLIENT_PORT,
  "0.0.0.0",
  () => {

    console.log(
      "================================"
    );

    console.log(
      "UDP CLIENT STARTED"
    );

    console.log(
      `Device: ${DEVICE_NAME}`
    );

    console.log(
      `Device ID: ${DEVICE_ID}`
    );

    console.log(
      `Listening on UDP port ${CLIENT_PORT}`
    );

    console.log(
      `Server: ${SERVER_IP}:${SERVER_PORT}`
    );

    console.log(
      "================================"
    );


    /*
    Register after starting
    */

    registerDevice();

  }
);


/*
====================================================
HEARTBEAT EVERY 10 SECONDS
====================================================
*/

setInterval(
  sendHeartbeat,
  10000
);