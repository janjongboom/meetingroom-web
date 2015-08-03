# Meetingroom-web

This is the web interface for a smart meetingroom.
It's an interface to a physical device that is located within the meetingroom,
which communicates over BLE and MQTT.
In our tests MQTT messages are dispatched over a LoRa network, so the device
does not need network connectivity nor power in the office.

## Prerequisites

The device, at it's bare minimum, requires a PIR sensor for motion detection
and a networking chip.
The motion data is then sent on regular intervals to ThingFabric over MQTT.
Highly recommended is a BLE chip that broadcasts the URL of the meeting room
over [physical web](http://physical-web.org/) for discoverability.

The MQTT message needs to have a property `rise_state` (0|1),
which specifies whether motion was detected when the package was sent,
and a property `last_rise`, which is the last time motion was detected
(in seconds ago).

The meeting room needs to have a Google Calendar, in which appointments are
created. This is used as the data store.

## Configuration

In the config folder you can create a new configuration file.
A config file contains of the following fields:

* `clear_mu_cache` Whether to clear the template cache before rendering.
                   Use this whenever you're developing, otherwise changes to
                   your HTML are not shown straight away.
* `hostname` Base URL of your service (needs to be registed with Google API)
* `thingfabric_server` Thingfabric API with your domain and stuff specified
* `rooms` Each meetingroom you want to manage.
          calendarId is the Google Calendar, thing the name in ThingFabric

## Starting up

You'll need credentials for the Google Calendar API, and credentials for the
ThingFabric API. Then start up with:

```bash
CLIENT_ID=q CLIENT_SECRET=r TF_USER=s TF_PASSWORD=t node server.js dev
#q = Google ClientID
#r = Google Secret
#s = ThingFabric User
#t = ThingFabric Password
#dev = Name of the config file (expands to config/dev.json)
```

Then go to /rooms/bdb1 (or your room name) to start the app.
