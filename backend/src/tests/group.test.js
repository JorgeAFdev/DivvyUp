// Must be set before the modules below are loaded: both jwt.js and user.schema.js
// capture process.env.jwt_secret at import time.
process.env.jwt_secret = process.env.jwt_secret || "test-secret";

const supertest = require("supertest");
const { bootstrapApp } = require("../bootstrap");
const app = bootstrapApp();
const fakeRequest = supertest(app);
const { disconnectDB, connectDB } = require("../mongo/connection");
const Group = require("../schemas/group.schema");
const User = require("../schemas/user.schema")
const setUpGroup = async () => {
    const groupData = Group.create(
        {
            name: "GroupName",
            description: "GroupDescription",
            members: [
                { user: `${userData._id.toString()}` }
            ]
        }
    )
    return groupData

}

const setUpUser = async () => {
    const userData = User.create(
        {
            name: "user",
            email: "user@user.com",
            password: "password"
        }
    )
    return userData
}

let groupData
let userData
let token
beforeAll(async () => {
    await connectDB()
    userData = await setUpUser();
    groupData = await setUpGroup();
    token = userData.generateJWT();
})

afterAll((done) => {
    disconnectDB().then(() => {
        console.log("Disconnected from test database!");
        done();
    });
});


describe("Group Controller TEST", () => {

    describe("GET /group/:groupId", () => {
        it("get groups by group Id", async () => {
            const response = await fakeRequest
                .get(`/group/${groupData._id.toString()}`)
                .set("Authorization", `Bearer ${token}`);
            expect(response.status).toBe(200);
        });

        it("rejects a request without a token", async () => {
            const response = await fakeRequest.get(`/group/${groupData._id.toString()}`);
            expect(response.status).toBe(401);
        });
    }
    )


})

