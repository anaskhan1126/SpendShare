const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const Flat = require("../models/Flat");

async function syncModelIndexes() {
    try {
        const collection = Admin.collection;
        const indexes = await collection.indexes();

        const phoneIndex = indexes.find(idx => idx.name === "phone_1");
        if (phoneIndex && !phoneIndex.sparse) {
            await collection.dropIndex("phone_1");
            console.log("Dropped non-sparse phone_1 index on admins");
        }

        await Admin.syncIndexes();
        await Flat.syncIndexes();
    } catch (error) {
        if (error.code !== 27) {
            console.warn("Index sync:", error.message);
        }
    }
}

const connectDB = async () => {

    try {

        const connection = await mongoose.connect(process.env.MONGO_URI);

        console.log(`MongoDB Connected : ${connection.connection.host}`);

        await syncModelIndexes();

    } catch (error) {

        console.error("MongoDB Connection Failed");

        console.error(error.message);

        process.exit(1);

    }

};

module.exports = connectDB;