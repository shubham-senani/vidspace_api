import express from "express";
import "dotenv/config";
import connectDB from "./db/db.js";
import app from "./app.js"

connectDB()
    .then(() => {
        app.listen(process.env.PORT || 8080, () => {
            console.log(`server is running on port: ${process.env.PORT}`)
        })
    }).catch((err) => {
        console.log("MONGO db connection failed !!", err)
    })















/***************************************************** 
 * 
 import mongoose from "mongoose";
import express from "express";
import "dotenv/config";
import { DB_NAME } from "./constants.js";

const app = express();
; (async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

        app.on("error", (error) => {
            console.log("ERR: " + error);
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`server is running on port: ${process.env.PORT}`);
        });

    } catch (error) {
        console.error("ERR: " + error);
        throw error
    }
})()
 * 
 ***********************************************************************/