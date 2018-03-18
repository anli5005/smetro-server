const express = require("express");
const mongoose = require("mongoose");

const config = require("../config.json");
const stations = require("../stations.json");

let app = express();
app.use(express.json());

mongoose.connect(config.mongo);
mongoose.connection.once("open", () => {
  let computerSchema = mongoose.Schema({
    label: String,
    auth: {type: String, required: true, unique: true},
    canReadTrips: {type: Boolean, required: true, default: true},
    canWriteTrips: {type: Boolean, required: true, default: true},
    canDeleteTrips: {type: Boolean, required: true, default: true},
    station: {type: String, enum: stations}
  });
  let tripSchema = mongoose.Schema({
    player: {type: String, required: true, unique: true},
    destination: {type: String, required: true, enum: stations}
  });

  const Computer = mongoose.model("Computer", computerSchema);
  const Trip = mongoose.model("Trip", tripSchema);

  async function authenticate(req, res, permission) {
    let computer = await Computer.findOne({auth: req.get("Authorization")});
    if (!computer) {
      console.log("Unauthorized");
      res.status(401);
      req.query.lson ? res.send('{error = "unauthorized"}') : res.json({error: "unauthorized"});
    } else if (!computer[permission]) {
      console.log("Forbidden");
      res.status(403);
      req.query.lson ? res.send('{error = "forbidden"}') : res.json({error: "forbidden"});
    }
    return true;
  }

  app.get("/api/v1/trip/:player", async (req, res) => {
    try {
      if (await authenticate(req, res, "canReadTrips")) {
        let trip = await Trip.findOne({player: req.params.player});
        if (!trip) {
          res.status(404);
          return req.query.lson ? res.send('{error = "not_found"}') : res.json({error: "not_found"});
        }

        return req.query.lson ? res.send(`{ok = true, destination = ${trip.destination}}`) : res.json({
          ok: true,
          destination: trip.destination
        });
      }
    } catch (e) {
      console.log(e);
      res.status(500);
      return req.query.lson ? res.send('{error = "internal_server_error"}') : res.json({error: "internal_server_error"});
    }
  });

  app.post("/api/v1/trip/:player", async (req, res) => {
    try {
      if (await authenticate(req, res, "canWriteTrips")) {
        if (!stations.includes(req.body.destination || req.query.destination)) {
          console.log("Invalid station");
          res.status(400);
          return req.query.lson ? res.send('{error = "invalid_station"}') : res.json({error: "invalid_station"});
        }

        if ((await Trip.count({player: req.params.player})) > 0) {
          console.log("Already exists");
          res.status(400);
          return req.query.lson ? res.send('{error = "already_exists"}') : res.json({error: "already_exists"});
        }

        let trip = new Trip({player: req.params.player, destination: req.body.destination || req.query.destination});
        await trip.save();

        return req.query.lson ? res.send(`{ok = true}`) : res.json({ok: true});
      }
    } catch (e) {
      console.log(e);
      res.status(500);
      return req.query.lson ? res.send('{error = "internal_server_error"}') : res.json({error: "internal_server_error"});
    }
  });

  app.post("/api/v1/trip/:player/delete", async (req, res) => {
    try {
      if (await authenticate(req, res, "canDeleteTrips")) {
        let trip = await Trip.findOne({player: req.params.player});
        if (!trip) {
          res.status(404);
          return req.query.lson ? res.send('{error = "not_found"}') : res.json({error: "not_found"});
        }

        await trip.remove();

        return req.query.lson ? res.send(`{ok = true}`) : res.json({ok: true});
      }
    } catch (e) {
      console.log(e);
      res.status(500);
      return req.query.lson ? res.send('{error = "internal_server_error"}') : res.json({error: "internal_server_error"});
    }
  });

  app.listen(config.port);
});
