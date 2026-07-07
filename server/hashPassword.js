const bcrypt = require("bcrypt");

async function generate() {
    const hash = await bcrypt.hash("123456", 10);
    console.log(hash);
}

generate();