const bcrypt = require("bcrypt");

async function test() {

    const hash = "$2b$10$M6xPOzm/RwJNRbJiGZsxh.bK3WVEqxdc8zEHnCr9TcT40vIAQidbq";

    const result = await bcrypt.compare("123456", hash);

    console.log(result);

}

test();