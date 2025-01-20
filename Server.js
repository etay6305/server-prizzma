const http = require('http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const { postgraphile } = require('postgraphile');
const { Pool } = require('pg'); // חיבור ל-PostgreSQL
const socketIo = require('socket.io');
const app = express();
const ConnectionFilterPlugin = require('postgraphile-plugin-connection-filter');
const { GraphQLObjectType, GraphQLSchema, GraphQLString, GraphQLList, GraphQLFloat,  GraphQLInt } = require('graphql');
const { gql, GraphQLClient } = require('graphql-request'); 

// יצירת שרת
const server = http.createServer(app);

// אפשרות להוספת עוגיות
app.use(cookieParser());

const io = socketIo(server, {
      cors: {
        origin: 'http://localhost:5173', // אפשר לשרת את האתר ב- localhost
        methods: ['GET', 'POST', 'DELETE', 'PATCH'], // שיטות מותרות
        credentials: true // מאפשר עוגיות
      },
});

// הוספת הכותרת ישירות לכל בקשה
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});


io.on("connection", (socket) => {
  console.log(socket.id);

  socket.on("join_room", (data) => {
    socket.join(data);
    console.log(`user with ID: ${socket.id} joined room: ${data}`);
  })

  socket.on("send_message", (data) => {
    console.log(data);
    socket.to(data.room).emit("receive_message", data);

  });

  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);
  })
});


const graphqlClient = new GraphQLClient('http://localhost:5000/graphql');

// יצירת חיבור למסד נתונים של PostgreSQL
const pool = new Pool({
  user: 'postgres', // שם משתמש למסד הנתונים
  host: 'localhost',
  database: 'prizma_db', // שם מסד הנתונים
  password: 'etay6305', // הסיסמה
  port: 5432,
});

// הגדרת השרת עם PostGraphile
app.use(
  postgraphile(
    pool,
    'public', // או הסכימה שברצונך לחשוף
    {
      appendPlugins: [ConnectionFilterPlugin],
      watch: true, // מאפשר לשדרג את ה-schema אוטומטית אם יש שינוי
      graphiql: true, // מאפשר לגשת ל-GrapphiQL דרך דפדפן
      retryOnInitFail: true, // ינסה להתחבר למסד גם אם יש כשל
    }
  )
);


// // אפשרות להוספת עוגיות
// app.use(cookieParser());
// app.use(cors({
//   origin: 'http://localhost:5173', // אפשר לשרת את האתר ב- localhost
//   methods: ['GET', 'POST', 'DELETE', 'PATCH'], // שיטות מותרות
//   credentials: true // מאפשר עוגיות
// }));

// סוג נתונים של משתמש
const UserType = new GraphQLObjectType({ 
  name: 'User',
  fields: {
    name: { type: GraphQLString },
    password: {type: GraphQLString},
    email: { type: GraphQLString },
  },
});

const TransmitterType = new GraphQLObjectType({
  name: 'Transmitter',
  fields: {
    name: { type: GraphQLString },
    frequency_range: { type: GraphQLString },
    bandwidth: { type: GraphQLFloat }, 
    power: { type: GraphQLFloat },
    antenna_type: { type: GraphQLString }, 
    coverage_radius: { type: GraphQLFloat }, 
    F: { type: GraphQLFloat }, 
    antenna_gain: { type: GraphQLFloat }, 
    receiver_sensitivity: { type: GraphQLFloat }, 
    noiseFigure: { type: GraphQLFloat},
    latitude: {type: GraphQLFloat},
    longitude: {type: GraphQLFloat},
  },
});

const CoverageAreaType = new GraphQLObjectType({
  name: 'CoverageArea',
  fields: {
    area_id: { type: GraphQLString }, // מזהה האזור
    name: { type: GraphQLString }, // שם האזור
    description: { type: GraphQLString }, // תיאור
    latitude: { type: GraphQLFloat }, // קו רוחב
    longitude: { type: GraphQLFloat }, // קו אורך
    radius: {type: GraphQLFloat }
  },
});

const SystemAllocationType = new GraphQLObjectType({
  name: 'SystemAllocation',
  fields: {
    allocation_id: { type: GraphQLString }, // מזהה ההקצאה
    transmitter_name: { type: GraphQLString }, // שם המשדר (קישור ל-Transmitter)
    area_id: { type: GraphQLString }, // מזהה האזור (קישור ל-CoverageArea)
    allocated_radius: { type: GraphQLFloat } // רדיוס הכיסוי המשויך
  },
});


const OptimizationResultType = new GraphQLObjectType({
  name: 'OptimizationResult',
  fields: {
    result_id: { type: GraphQLString }, // מזהה ייחודי לתוצאה
    area_id: { type: GraphQLString }, // מזהה האזור (קישור ל-CoverageArea)
    system_count: { type: GraphQLInt }, // מספר המערכות שהוצבו
    total_coverage: { type: GraphQLFloat } // אחוז הכיסוי שהושג
  },
});



// הגדרת Nodemailer לשליחת אימיילים
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true אם SSL, false אם TLS
  auth: {
    user: 'etayfrid@gmail.com', // האימייל שלך
    pass: 'lfiu rkzx canr jcoh', // הסיסמה שלך
  },
});

// פונקציה לשליחת אימייל אישור
const sendConfirmationEmail = (to, username) => {
  const mailOptions = {
    from: {
      name: 'TUNER-X',
      address: 'your-email@gmail.com',
    },
    to: to,
    subject: 'Confirm Your Email',
    html: `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #0d0d0d, #1a1a1a); color: #f1f1f1; padding: 40px; border-radius: 20px; max-width: 700px; margin: 0 auto; box-shadow: 0 0 30px rgba(0, 230, 230, 0.7); position: relative; overflow: hidden;">
      <h2 style="color: #00e6e6; text-align: center; font-size: 32px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin: 20px 0;">
        Welcome to TUNER-X, ${username}!
      </h2>
      <p style="font-size: 20px; text-align: center; color: #cccccc;">
        You're now part of our cutting-edge tech community. To activate your account and unlock the full experience, please confirm your email.
      </p>
      <div style="text-align: center; margin: 40px 0;">
        <a href="http://your-website.com/confirm?email=${to}" style="background: linear-gradient(145deg, #00e6e6, #005f73); color: #ffffff; padding: 18px 36px; text-decoration: none; font-weight: bold; border-radius: 50px; font-size: 18px; display: inline-block; box-shadow: 0 10px 20px rgba(0, 230, 230, 0.7); transition: transform 0.3s ease, box-shadow 0.3s ease; letter-spacing: 1px;">
          CONFIRM EMAIL
        </a>
      </div>
      <p style="color: #999999; text-align: center; font-size: 14px;">
        If the button doesn't work, click the link below:
      </p>
      <p style="text-align: center;">
        <a href="http://your-website.com/confirm?email=${to}" style="color: #00e6e6; text-decoration: none;">
          http://your-website.com/confirm?email=${to}
        </a>
      </p>
      <hr style="border: 1px solid #333; margin: 40px 0;">
      <footer style="text-align: center; color: #666666; margin-top: 20px;">
        <p style="font-size: 12px;">TUNER-X © 2024. All rights reserved.</p>
        <p style="font-size: 12px;">1234 Street Name, Tech City, Futureland</p>
      </footer>
    </div>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
};

// הגדרת רוטים נוספים עבור ניהול משתמשים (לדוגמה)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// פונקציה להוספת משתמש חדש
app.post('/sighn-password', async (req, res) => {
  const { name, password, email } = req.body;

  // GraphQL Queries and Mutations
  ////////////////////////////////////////////////////////////הערה סופר חשובה, בתוך הnodes יופיעו השדות שישלפו
  const CHECK_USER_QUERY = gql`
    query ($name: String!, $email: String!) {
      allUsers(filter: { or: [{ name: { equalTo: $name } }, { email: { equalTo: $email } }] }) {
        nodes {
         name
        }
      }
    }
  `;
  //query = מציין שהשאילתה נועדה לשלוף נתונים
  // mutation = מציין שהשאילתה נוצרה לעדכן/ליצור נתונים
  // ! = מציין שהפרמטר חייב ליהיות מסופק
  const CREATE_USER_MUTATION = gql`
    mutation ($name: String!, $password: String!, $email: String!) {
      createUser(input: { user: { name: $name, password: $password, email: $email } }) {
        user {
          name
        }
      }
    }
  `;

  try {
    // בדיקת קיום משתמש
    const existingUser = await graphqlClient.request(CHECK_USER_QUERY, { name, email });

    if (existingUser.allUsers.nodes.length > 0) {
      return res.status(409).send(`User ${name} already exists.`);
    }

    // יצירת משתמש חדש
    const newUser = await graphqlClient.request(CREATE_USER_MUTATION, { name, password, email });

    sendConfirmationEmail(email, name); // שליחת מייל לאישור
    res.status(200).send(`User ${newUser.createUser.user.name} registered successfully.`);
  } catch (error) {
    console.error('Error handling registration:', error);
    res.status(500).send('Server error');
  }
});

// פונקציה להתחברות משתמש
app.post('/submit-password', async (req, res) => {
  const { name, password } = req.body;


  const CHECK_USER_QUERY = gql`
    query ($name: String!, $password: String!) {
      allUsers(condition: { name: $name, password: $password }) {
        nodes {
          name
        }
      }
    }
  `;


  try {
    const result = await graphqlClient.request(CHECK_USER_QUERY, {name, password});

    if (result.allUsers.nodes.length > 0) {
      res.status(200).send(`User ${result.allUsers.nodes[0].name} logged in successfully.`);
    } else {
      res.status(401).send(`User not exist`);
    }
  } catch (error) {
    console.error('Error handling request:', error);
    res.status(500).send('Server error');
  }
});


app.post('/change-password', async (req, res) => {
  const { new_name, new_password, name, password } = req.body;

  // שאילתה לבדיקה אם המשתמש הישן קיים
  const CHECK_OLD_USER_EXIST = gql`
    query ($name: String!, $password: String!) {
      allUsers(filter: { 
        and: [
          { name: { equalTo: $name } },
          { password: { equalTo: $password } }
        ]
      }) {
        nodes {
          nodeId
        }
      }
    }
  `;

  // שאילתה לבדיקה אם השם החדש כבר קיים
  const CHECK__NEW_USER_NAME = gql`
    query ($new_name: String!) {
      allUsers(filter: { name: { equalTo: $new_name } }) {
        nodes {
          name
        }
      }
    }
  `;

  // עדכון פרטי המשתמש
  const UPDATE_USER_DATA_MUTATION = gql`
    mutation UpdateUser($nodeId: ID!, $new_name: String!, $new_password: String!) {
      updateUser(input: { 
        nodeId: $nodeId, 
        userPatch: { name: $new_name, password: $new_password } 
      }) {
        user {
          name
        }
      }
    }
  `;

  try {
    // בדוק אם המשתמש עם השם והסיסמה הנוכחיים קיים
    const oldUserResult = await graphqlClient.request(CHECK_OLD_USER_EXIST, { name, password });
    if (!oldUserResult.allUsers.nodes.length) {
      return res.status(404).send('That user does not exist.');
    }

    // קבלת ה-nodeId של המשתמש הקיים
    const nodeId = oldUserResult.allUsers.nodes[0].nodeId;

    // בדוק אם השם החדש כבר קיים
    const newNameResult = await graphqlClient.request(CHECK__NEW_USER_NAME, { new_name });
    if (newNameResult.allUsers.nodes.length) {
      return res.status(409).send('That username already exists.');
    }

    // עדכן את פרטי המשתמש
    const updatedUser = await graphqlClient.request(UPDATE_USER_DATA_MUTATION, {
      nodeId,
      new_name,
      new_password,
    });

    if (updatedUser.updateUser.user.name) {
      return res.status(200).send(`User updated successfully: ${updatedUser.updateUser.user.name}`);
    }

    res.status(500).send('Failed to update user.');
  } catch (error) {
    console.error('Error handling registration:', error);
    res.status(500).send('Server error.');
  }
});





app.post('/add-transmitter', async (req, res) => {
  const {  name,
    frequencyRange,
    bandwidth,
    power,
    antennaType,
    coverageRadius,
    f,
    antennaGain,
    receiverSensitivity,
    noiseFigure } = req.body;

  const CHECK_transmitter_QUERY = gql`
    query ($name: String!) {
      allTransmitters(filter: { name: { equalTo: $name } }) {
        nodes {
         name
        }
      }
    }
  `;
  
  const CREATE_TRANSMITTER_MUTATION = gql`
  mutation CreateTransmitter(
     $name: String!,
    $frequencyRange: String!,
    $bandwidth: Float!,
    $power: Float!,
    $antennaType: String!,
    $coverageRadius: Float!,
    $f: Float!,
    $antennaGain: Float!,
    $receiverSensitivity: Float!,
    $noiseFigure: Float!
  ) {
    createTransmitter(
      input: {
        transmitter: {
           name: $name,
          frequencyRange: $frequencyRange,
          bandwidth: $bandwidth,
          power: $power,
          antennaType: $antennaType,
          coverageRadius: $coverageRadius,
          f: $f,
          antennaGain: $antennaGain,
          receiverSensitivity: $receiverSensitivity,
          noiseFigure: $noiseFigure
        }
      }
    ) {
      transmitter {
        name
      }
    }
  }
`;


  try {
    // בדיקת קיום ישות
    const existingTransmitter = await graphqlClient.request(CHECK_transmitter_QUERY, { name });

    if (existingTransmitter.allTransmitters.nodes.length > 0) {
      return res.status(409).send(`transmitter ${name} already exists.`);
    }

    // יצירת משתמש חדש
    const newTransmitter = await graphqlClient.request(CREATE_TRANSMITTER_MUTATION, { name,
      name,
      frequencyRange,
      bandwidth,
      power,
      antennaType,
      coverageRadius,
      f,
      antennaGain,
      receiverSensitivity,
      noiseFigure  });

    res.status(200).send(`transmitter added successfully.`);
  } catch (error) {
    console.error('Error handling registration:', error);
    res.status(500).send('Server error');
  }
});

app.get("/show-transmitters", async (req,res) => {
  const GET_ALL_TRANSMITTERS_QUERY = gql`
  query {
    allTransmitters {
      nodes {
        name
        frequencyRange
        bandwidth
        power
        antennaType
        coverageRadius
        f
        antennaGain
        receiverSensitivity
        noiseFigure
      }
    }
  }
`;
try {
  // שליחת השאילתה למסד הנתונים
  const result = await graphqlClient.request(GET_ALL_TRANSMITTERS_QUERY);

  let transmitters = result.allTransmitters.nodes;

  // החזרת הנתונים שנמצאו
  res.status(200).json(transmitters);
} catch (error) {
  console.error("Error fetching transmitters:", error);
  res.status(500).send("Server error while fetching transmitters.");
}
});


app.delete("/delete-transmitter/:name", async (req, res) => {
  const { name } = req.params;

  const DELETE_TRANSMITTER_MUTATION = gql`
    mutation ($name: String!) {
      deleteTransmitterByName(input: { name: $name }) {
        deletedTransmitterId
      }
    }
  `;

  try {
    const result = await graphqlClient.request(DELETE_TRANSMITTER_MUTATION, { name });
    res.status(200).send("Transmitter deleted successfully.");
  } catch (error) {
    console.error("Error deleting transmitter:", error);
    res.status(500).send("Failed to delete transmitter.");
  }
});

app.get("/radius/:name", async (req, res) => {
  const { name } = req.params;

  const QUERY_TRANSMITTER_MUTATION = gql`
    query ($name: String!) {
      allTransmitters(filter: { name: { equalTo: $name } }) {
        nodes {
          name
          frequencyRange
          bandwidth
          power
          antennaType
          coverageRadius
          f
          antennaGain
          receiverSensitivity
          noiseFigure
          latitude
          longitude
        }
      }
    }
  `;

  try {
    const result = await graphqlClient.request(QUERY_TRANSMITTER_MUTATION, { name });
    const transmitter = result.allTransmitters.nodes[0];

    if (!transmitter) {
      return res.status(404).send("Transmitter not found.");
    }

    // פרמטרים מהמסד
    const power = transmitter.power; // הספק (W)
    const antennaGain = transmitter.antennaGain; // רווח אנטנה (dB)
    const frequency = transmitter.f * 1e6; // תדר (Hz)
    const bandwidth = transmitter.bandwidth; // רוחב פס (Hz)
    let receiverSensitivity = transmitter.receiverSensitivity; // רגישות מקלט (dBm)
    const noiseFigure = transmitter.noiseFigure; // מקדם רעש (dB)

    // המרת רגישות מקלט לערך שלילי אם נדרש
    receiverSensitivity = -Math.abs(receiverSensitivity);

    // המרת ערכים ליחידות מתאימות
    const G_t = Math.pow(10, antennaGain / 10); // המרת dB ליחס לינארי
    const G_r = G_t; // רווח אנטנה מקבלת זהה
    const lambda = 3e8 / frequency; // אורך גל במטרים

    // חישוב עוצמת הרעש (Noise Power)
    const k = 1.38e-23; // קבוע בולצמן (J/K)
    const T = 290; // טמפרטורה בקלווין (כ-17°C)
    const noisePower = k * T * bandwidth; // עוצמת רעש תרמי (W)

    // חישוב מקדם רעש
    const noiseFactor = Math.pow(10, noiseFigure / 10); // המרת dB ליחס לינארי

    // יחס אות לרעש נדרש (SNR)
    const requiredSNR = Math.pow(10, receiverSensitivity / 10); // יחס אות לרעש נדרש (W)

    // עוצמת קליטה נדרשת כולל רעש
    const requiredReceivedPower = noisePower * noiseFactor * requiredSNR;

    // אובדן נתיב חופשי (FSPL) בתנאים אידיאליים
    const FSPL = Math.pow((4 * Math.PI * frequency) / (3e8), 2);

    // חישוב רדיוס הכיסוי
    const radius = Math.sqrt((power * G_t * G_r) / (requiredReceivedPower * FSPL));

    // החזרת התוצאה
    res.status(200).json({ radius: radius.toFixed(2) }); // רדיוס במטרים
  } catch (error) {
    console.error("Error calculating transmitter radius:", error);
    res.status(500).send("Failed to calculate transmitter radius.");
  }
});

app.patch("/update-transmitter", async (req, res) => {
  const { old_name, new_name } = req.body;

  const CHECK_TRANSMITTER_EXIST = gql`
    query ($name: String!) {
      allTransmitters(filter: { name: { equalTo: $name } }) {
        nodes {
          nodeId
        }
      }
    }
  `;

  const UPDATE_TRANSMITTER_DATA_MUTATION = gql`
    mutation UpdateTransmitter($nodeId: ID!, $new_name: String!) {
      updateTransmitter(
        input: { nodeId: $nodeId, transmitterPatch: { name: $new_name } }
      ) {
        transmitter {
          name
        }
      }
    }
  `;

  try {
    // בדיקה אם המשדר עם השם הישן קיים
    const oldResult = await graphqlClient.request(CHECK_TRANSMITTER_EXIST, { name: old_name });
    if (!oldResult.allTransmitters.nodes.length) {
      return res.status(404).send("Transmitter not found.");
    }

    const nodeId = oldResult.allTransmitters.nodes[0].nodeId;

    // בדיקה אם השם החדש כבר קיים
    const newResult = await graphqlClient.request(CHECK_TRANSMITTER_EXIST, { name: new_name });
    if (newResult.allTransmitters.nodes.length) {
      return res.status(409).send("New name already exists.");
    }

    // עדכון השם
    const updatedResult = await graphqlClient.request(UPDATE_TRANSMITTER_DATA_MUTATION, {
      nodeId,
      new_name,
    });

    if (updatedResult.updateTransmitter.transmitter.name) {
      return res.status(200).json({
        message: "Transmitter updated successfully.",
        newName: updatedResult.updateTransmitter.transmitter.name,
      });
    } else {
      return res.status(500).send("Failed to update transmitter.");
    }
  } catch (error) {
    console.error("Error updating transmitter:", error);
    res.status(500).send("Server error.");
  }
});

app.post('/add-coverage-area', async (req, res) => {
  const { name, description, latitude, longitude, radius } = req.body;

  const CREATE_COVERAGE_AREA_MUTATION = gql`
    mutation CreateCoverageArea(
      $name: String!,
      $description: String!,
      $latitude: Float!,
      $longitude: Float!,
      $radius: Float!,
    ) {
      createCoverageArea(
        input: {
          coverageArea: {
            name: $name,
            description: $description,
            latitude: $latitude,
            longitude: $longitude,
            radius: $radius
          }
        }
      ) {
        coverageArea {
          areaId
        }
      }
    }
  `;
   
  const CHECK_COVERAGENAME_EXIST = gql`
    query ($name: String!) {
      allCoverageAreas(filter: { name: { equalTo: $name }}) {
        nodes {
         name
        }
      }
    }
  `;

  try {
    const CheckCoverageExist = await graphqlClient.request(CHECK_COVERAGENAME_EXIST, {name});
    if(CheckCoverageExist.allCoverageAreas.nodes.length > 0) {
      return res.status(409).send(`Coverage area ${name} is exist.`);
    }
    const result = await graphqlClient.request(CREATE_COVERAGE_AREA_MUTATION, { name, description, latitude, longitude, radius });
    res.status(200).send(`Coverage area ${name} added successfully.`);
  } catch (error) {
    console.error('Error adding coverage area:', error);
    res.status(500).send('Server error.');
  }
});


app.get('/show-coverage-areas', async (req, res) => {
  const GET_ALL_COVERAGE_AREAS_QUERY = gql`
    query {
      allCoverageAreas {
        nodes {
          areaId
          name
          description
          latitude
          longitude
          radius
        }
      }
    }
  `;

  try {
    const result = await graphqlClient.request(GET_ALL_COVERAGE_AREAS_QUERY);
    res.status(200).json(result.allCoverageAreas.nodes);
  } catch (error) {
    console.error('Error fetching coverage areas:', error);
    res.status(500).send('Server error.');
  }
});




app.delete("/delete-coverage/:areaId", async (req, res) => {
  let { areaId } = req.params;
  areaId = parseInt(areaId, 10);  // המרה למספר שלם
  
  const DELETE_Coverage_MUTATION = gql`
    mutation ($areaId: Int!) {
      deleteCoverageAreaByAreaId(input: { areaId: $areaId }) {
        deletedCoverageAreaId
      }
    }
  `;

  const FIND_TRANSMITTERS_BY_AREA = gql`
    query ($areaId: Int!) {
      allSystemAllocations(filter: {areaId: {equalTo: $areaId}}) {
        nodes { transmitterName }
      }
    }
  `;

  const GET_TRANSMITTER_NODE_ID = gql`
    query ($transmitterName: String!) {
      allTransmitters(filter: { name: { equalTo: $transmitterName } }) {
        nodes { nodeId }
      }
    }
  `;

  const UPDATE_TRANSMITTER_TO_NULL = gql`
    mutation UpdateTransmitter($nodeId: ID!) {
      updateTransmitter(input: { 
        nodeId: $nodeId, 
        transmitterPatch: { latitude: null, longitude: null } 
      }) {
        transmitter {
          name
        }
      }
    }
  `;

  try {

    // שלב 1: מציאת שמות המשדרים המשויכים לאזור
    const transmitterNamesResult = await graphqlClient.request(FIND_TRANSMITTERS_BY_AREA, { areaId });
    const transmitters = transmitterNamesResult.allSystemAllocations.nodes;

    // שלב 2: מציאת ה-nodeId של כל משדר ועדכון הקואורדינטות ל-null
    for (const transmitter of transmitters) {
      const nodeIdResult = await graphqlClient.request(GET_TRANSMITTER_NODE_ID, { transmitterName: transmitter.transmitterName });
      const nodeId = nodeIdResult.allTransmitters.nodes[0]?.nodeId;

      if (nodeId) {
        await graphqlClient.request(UPDATE_TRANSMITTER_TO_NULL, { nodeId });
      }
    }


    const result = await graphqlClient.request(DELETE_Coverage_MUTATION, { areaId });
    res.status(200).send("Coverage deleted successfully.");
  } catch (error) {
    console.error("Error deleting coverage:", error);
    res.status(500).send("Failed to delete transmitter.");
  }
});



app.post('/add-allocation-initial', async (req, res) => {
  const { transmitterName, allocatedRadius, nameOfCoverage } = req.body;

  // בדיקת קיום המשדר
  const CHECK_TRANSMITTER = gql`
    query ($transmitterName: String!) {
      allTransmitters(filter: { name: { equalTo: $transmitterName } }) {
        nodes { name }
      }
    }
  `;

  // בדיקת קיום אזור והבאת ה-areaId המתאים
  const CHECK_COVERAGE_AREA_ID = gql`
    query ($nameOfCoverage: String!) {
      allCoverageAreas(filter: { name: { equalTo: $nameOfCoverage } }) {
        nodes { areaId }
      }
    }
  `;

  // בדיקת קיום הקצאה עם areaId = null
  const CHECK_ALLOCATION_WITH_NULL_AREA = gql`
    query ($transmitterName: String!) {
      allSystemAllocations(
        filter: { 
          transmitterName: { equalTo: $transmitterName } 
        }
      ) {
        nodes { 
          nodeId
          areaId
        }
      }
    }
  `;

  // מוטציה ליצירת הקצאה חדשה
  const CREATE_ALLOCATION = gql`
    mutation CreateAllocation(
      $transmitterName: String!,
      $allocatedRadius: Float!,
      $areaId: Int
    ) {
      createSystemAllocation(
        input: {
          systemAllocation: {
            transmitterName: $transmitterName,
            allocatedRadius: $allocatedRadius,
            areaId: $areaId
          }
        }
      ) {
        systemAllocation {
          allocationId
        }
      }
    }
  `;

  // מוטציה לעדכון הקצאה קיימת עם areaId = null
  const UPDATE_ALLOCATION = gql`
    mutation UpdateAllocation($nodeId: ID!, $areaId: Int!) {
      updateSystemAllocation(
        input: { 
          nodeId: $nodeId, 
          systemAllocationPatch: { areaId: $areaId } 
        }
      ) {
        systemAllocation {
          allocationId
        }
      }
    }
  `;

  try {
    // בדיקה אם המשדר קיים
    const checkTransmitter = await graphqlClient.request(CHECK_TRANSMITTER, { transmitterName });
    if (checkTransmitter.allTransmitters.nodes.length === 0) {
      return res.status(404).send('Transmitter not found.');
    }

    // בדיקת קיום אזור
    let areaId = null;
    if (nameOfCoverage) {
      const checkCoverage = await graphqlClient.request(CHECK_COVERAGE_AREA_ID, { nameOfCoverage });
      if (checkCoverage.allCoverageAreas.nodes.length === 0) {
        return res.status(404).send('Coverage area not found.');
      }
      areaId = checkCoverage.allCoverageAreas.nodes[0].areaId;
    }

    // בדיקת קיום הקצאה קיימת למשדר
    const checkAllocation = await graphqlClient.request(CHECK_ALLOCATION_WITH_NULL_AREA, { transmitterName });
    if (checkAllocation.allSystemAllocations.nodes.length > 0) {
      const allocation = checkAllocation.allSystemAllocations.nodes[0];

      // אם קיימת הקצאה וה-areaId שלה שווה ל-null, מעדכנים אותה
      if (allocation.areaId === null) {
        await graphqlClient.request(UPDATE_ALLOCATION, {
          nodeId: allocation.nodeId,
          areaId: areaId,
        });
        return res.status(200).send(`Allocation updated for transmitter ${transmitterName}.`);
      }

      // אם כבר קיימת הקצאה משוייכת, מחזירים הודעת שגיאה
      return res.status(400).send('Transmitter already has an allocation with a coverage area.');
    }

    // אם לא קיימת הקצאה - יוצרים הקצאה חדשה
    const allocationResult = await graphqlClient.request(CREATE_ALLOCATION, {
      transmitterName,
      allocatedRadius,
      areaId,
    });

    res.status(200).send(`Allocation created with ID: ${allocationResult.createSystemAllocation.systemAllocation.allocationId}`);
  } catch (error) {
    console.error('Error handling allocation:', error);
    res.status(500).send('Server error.');
  }
});




app.get('/show-transmitters-with-coverage', async (req, res) => {
  const QUERY_TRANSMITTERS_WITH_ALLOCATIONS = gql`
    query {
      allSystemAllocations {
        nodes {
          transmitterName
          areaId
        }
      }
    }
  `;

  const QUERY_TRANSMITTERS = gql`
    query {
      allTransmitters {
        nodes {
          name
          latitude
          longitude
          frequencyRange
        }
      }
    }
  `;


  const query_name_of_coverage = gql`
    query ($areaId: Int!) {
      allCoverageAreas(
        filter: { 
          areaId: { equalTo: $areaId } 
        }
      ) {
        nodes { 
          name
        }
      }
    }
  `;


  

  try {
    // שליפת הנתונים
    const transmittersResult = await graphqlClient.request(QUERY_TRANSMITTERS);
    const allocationsResult = await graphqlClient.request(QUERY_TRANSMITTERS_WITH_ALLOCATIONS);

    const allocations = allocationsResult.allSystemAllocations.nodes;
    const transmitters = transmittersResult.allTransmitters.nodes;

    // טיפול במיזוג והוספת נתוני השיוך
    const mergedTransmitters = await Promise.all(transmitters.map(async (transmitter) => {
      const allocation = allocations.find(a => a.transmitterName === transmitter.name);

      let coverageName = null;

      if (allocation && allocation.areaId !== null) { // בדיקה אם יש areaId
        const coverageResult = await graphqlClient.request(query_name_of_coverage, { areaId: allocation.areaId });
        coverageName = coverageResult.allCoverageAreas.nodes.length > 0
          ? coverageResult.allCoverageAreas.nodes[0].name
          : null;
      }

      return {
        ...transmitter,
        areaId: allocation ? allocation.areaId : null,
        coverageName: coverageName // הוספת שם הכיסוי (coverage) לתוצאה
      };
    }));
     // החזרת הנתונים
     res.status(200).json(mergedTransmitters);

  } catch (error) {
    console.error('Error fetching transmitters with coverage:', error);
    res.status(500).send('Server error.');
  }
});



app.patch('/AddLatAndLongtotransmitter', async (req, res) => {
  const { name, latitude, longitude } = req.body;

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  // שאילתה לבדיקה אם המשדר קיים
  const CHECK_NAME_Transmitter = gql`
    query ($name: String!) {
      allTransmitters(filter: { 
           name: { equalTo: $name }
      }) {
        nodes {
          nodeId
        }
      }
    }
  `;

  // מוטציה לעדכון קואורדינטות
  const latitude_and_longitude_of_transmitter = gql`
    mutation UpdateTransmitter($nodeId: ID!, $lat: Float!, $lon: Float!) {
      updateTransmitter(input: { 
        nodeId: $nodeId, 
        transmitterPatch: { latitude: $lat, longitude: $lon } 
      }) {
        transmitter {
          name
        }
      }
    }
  `;

  try {
    
    // בדיקת קיום המשדר
    const checkTransmitterexist = await graphqlClient.request(CHECK_NAME_Transmitter, { name });
    if (checkTransmitterexist.allTransmitters.nodes.length === 0) {
      return res.status(404).send('Transmitter not found');
    }

    const nodeId = checkTransmitterexist.allTransmitters.nodes[0].nodeId;

    // עדכון קואורדינטות
    const updateResult = await graphqlClient.request(latitude_and_longitude_of_transmitter, {
      nodeId,
      lat,
      lon,
    });

    res.status(200).send("Latitude and longitude updated successfully!");

  } catch (error) {
    console.error('Error updating transmitter coordinates:', error);
    res.status(500).send('Server error.');
  }
});


app.get('/show-all-transmitter-on-map', async (req, res) => {
  const QUERY_TRANSMITTERS_WITH_COORDINATES = gql`
    query {
      allTransmitters(
        filter: { 
          and: [
            { latitude: { isNull: false } }, 
            { longitude: { isNull: false } }
          ]
        }
      ) {
        nodes {
          name
          latitude
          longitude
        }
      }
    }
  `;

  const radius_of_transmitter = gql`
    query {
      allSystemAllocations {
        nodes {
          transmitterName
          allocatedRadius
        }
      }
    }
  `;

  try {
    // שליפת המשדרים עם קואורדינטות תקינות
    const result = await graphqlClient.request(QUERY_TRANSMITTERS_WITH_COORDINATES);
    const located_radius_transmitters = await graphqlClient.request(radius_of_transmitter);

    // גישה לנתונים מתוך התשובות
    const transmitters = result.allTransmitters.nodes;
    const radiusData = located_radius_transmitters.allSystemAllocations.nodes;

    // עיבוד נתונים
    const transmittersWithRadius = transmitters.map(transmitter => {
      const radius = radiusData.find(a => a.transmitterName === transmitter.name);
      return {
        ...transmitter,
        allocatedRadius: radius ? radius.allocatedRadius : null
      };
    });

    // החזרת הנתונים ללקוח
    res.status(200).json(transmittersWithRadius);
  } catch (error) {
    console.error('Error fetching transmitters with coordinates:', error);
    res.status(500).send('Server error.');
  }
});



app.get('/show-all-transmitters-whitout-coverage', async (req, res) => {
  const get_all_transmitter_with_areaIdisnull = gql`
    query {
    allSystemAllocations(
      filter: { areaId: { isNull: true } }
    ) {
      nodes {
        areaId
        transmitterName
        allocatedRadius
      }
    }
  }
  `;
  try {
    const result = await graphqlClient.request(get_all_transmitter_with_areaIdisnull);
    const transmitters = result.allSystemAllocations.nodes;
    if (transmitters === 0) {
     return res.status(404);
    }

    res.status(200).json(transmitters);
  }catch(err) {
    console.log(err);
    res.status(500).send('server error');
  }
});




















// פונקציה לבדיקה אם שני משדרים חופפים בכיסוי
function checkCoverageOverlap(transmitter1, transmitter2) {
  const { latitude: lat1, longitude: lon1, coverageRadius: r1 } = transmitter1;
  const { latitude: lat2, longitude: lon2, coverageRadius: r2 } = transmitter2;

  const toRadians = (deg) => deg * (Math.PI / 180);

  const lat1Rad = toRadians(lat1);
  const lon1Rad = toRadians(lon1);
  const lat2Rad = toRadians(lat2);
  const lon2Rad = toRadians(lon2);

  const dLat = lat2Rad - lat1Rad;
  const dLon = lon2Rad - lon1Rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const earthRadius = 6371000;
  const distance = earthRadius * c;

  return distance < (r1 + r2);
}

// פונקציה לבדיקה אם שני משדרים חופפים בתדר
function checkFrequencyOverlap(transmitter1, transmitter2) {
  const [f1Start, f1End] = transmitter1.frequencyRange.split('-').map(Number);
  const [f2Start, f2End] = transmitter2.frequencyRange.split('-').map(Number);
  return f1Start <= f2End && f2Start <= f1End;
}

// פונקציה מרכזית לזיהוי חפיפות
function detectConflicts(transmitters) {
  const conflicts = [];
  for (let i = 0; i < transmitters.length; i++) {
      for (let j = i + 1; j < transmitters.length; j++) {
          const overlapCoverage = checkCoverageOverlap(transmitters[i], transmitters[j]);
          const overlapFrequency = checkFrequencyOverlap(transmitters[i], transmitters[j]);

          if (overlapCoverage || overlapFrequency) {
              conflicts.push({
                  transmitter1: transmitters[i].name,
                  transmitter2: transmitters[j].name,
                  overlapCoverage,
                  overlapFrequency
              });
          }
      }
  }
  return conflicts;
}

// נתיב לבדיקה עם שאילתות לתחומים והקצאות
app.get('/check-overlaps-by-area', async (req, res) => {
  // שאילתות GraphQL לקבלת נתונים
  const GET_TRANSMITTERS_QUERY = gql`
    query {
      allTransmitters {
        nodes {
          name
          latitude
          longitude
          frequencyRange
        }
      }
    }
  `;

  const GET_ALLOCATIONS_QUERY = gql`
    query {
      allSystemAllocations {
        nodes {
          transmitterName
          allocatedRadius
          areaId
        }
      }
    }
  `;

  try {
    // שליפת משדרים והקצאות
    console.log("Fetching transmitters...");
    const resultTransmitters = await graphqlClient.request(GET_TRANSMITTERS_QUERY);
    const transmitters = resultTransmitters.allTransmitters.nodes;

    console.log("Fetching allocations...");
    const resultAllocations = await graphqlClient.request(GET_ALLOCATIONS_QUERY);
    const allocations = resultAllocations.allSystemAllocations.nodes;

    console.log("Mapping data...");
    // סינון רק את המשדרים שמשויכים לאזור (areaId לא שווה ל-null)
    const transmittersWithDetails = transmitters.map(transmitter => {
      const allocation = allocations.find(a => a.transmitterName === transmitter.name);
      if (allocation && allocation.areaId !== null) {
        return {
          ...transmitter,
          coverageRadius: allocation.allocatedRadius,
          areaId: allocation.areaId, // שים לב, אם areaId לא null זה רק אז נכניס את המשדר למפה
        };
      }
      return null; // אם המשדר לא משויך לאזור, מחזירים null
    }).filter(transmitter => transmitter !== null); // מסנן את ה-null שנותרו

    console.log("Grouping by area...");
    // קיבוץ לפי אזור
    const groupedByArea = transmittersWithDetails.reduce((groups, transmitter) => {
      const areaId = transmitter.areaId;
      if (!groups[areaId]) groups[areaId] = [];
      groups[areaId].push(transmitter);
      return groups;
    }, {});

    console.log("Detecting conflicts...");
    const conflictsByArea = {};
    Object.keys(groupedByArea).forEach(areaId => {
      const group = groupedByArea[areaId];
      const conflicts = detectConflicts(group);
      conflictsByArea[areaId] = conflicts;
    });

    console.log("Conflicts detected:", conflictsByArea);

    // החזרת תוצאות מעודכנות ללקוח
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Expires', '-1');
    res.setHeader('Pragma', 'no-cache');
    res.status(200).json(conflictsByArea);

  } catch (error) {
    console.error('Error checking overlaps:', error);
    res.status(500).send('Server error.');
  }
});















//////////////////////////// אלגוריתם אחוז כיסוי של איזור מסויים 
const turf = require('@turf/turf');

app.get('/coverage-percentage/:areaId', async (req, res) => {
  const areaId = parseInt(req.params.areaId, 10);

  if (isNaN(areaId)) {
    return res.status(400).json({ error: 'Invalid areaId. Must be an integer.' });
  }

  const GET_AREA_QUERY = gql`
    query ($areaId: Int!) {
      coverageAreaByAreaId(areaId: $areaId) {
        latitude
        longitude
        radius
      }
    }
  `;

  const GET_TRANSMITTERS_QUERY = gql`
    query ($areaId: Int!) {
      allSystemAllocations(filter: { areaId: { equalTo: $areaId } }) {
        nodes {
          allocatedRadius
          transmitterByTransmitterName {
            latitude
            longitude
          }
        }
      }
    }
  `;

  try {
    const areaResult = await graphqlClient.request(GET_AREA_QUERY, { areaId });
    const area = areaResult.coverageAreaByAreaId;
    console.log(area);

    if (!area) {
      return res.status(404).json({ error: `Area with ID ${areaId} not found.` });
    }

    const transmittersResult = await graphqlClient.request(GET_TRANSMITTERS_QUERY, { areaId });
    const transmitters = transmittersResult.allSystemAllocations.nodes;
    console.log(transmitters);
    if (transmitters.length === 0) {
      return res.status(200).json({ areaId, coveragePercentage: 0 });
    }

    const areaCircle = turf.circle(
      [area.longitude, area.latitude],
      area.radius / 1000,
      { steps: 64, units: 'kilometers' }
    );

    const transmitterCircles = transmitters.map(transmitter => {
      const radius = transmitter.allocatedRadius;
      return turf.circle(
        [transmitter.transmitterByTransmitterName.longitude, transmitter.transmitterByTransmitterName.latitude],
        radius / 1000,
        { steps: 64, units: 'kilometers' }
      );
    });

    let unionCoverage;
    if (transmitterCircles.length === 1) {
      // אם יש רק משדר אחד, משתמשים בעיגול של המשדר
      unionCoverage = transmitterCircles[0];
    } else {
      // בצע איחוד בין כל העיגולים
      unionCoverage = transmitterCircles.reduce((acc, circle) => turf.union(acc, circle));
    }

    // בדיקת חפיפה עם האזור
    const intersection = turf.intersect(areaCircle, unionCoverage);

    const coveredArea = intersection ? turf.area(intersection) : 0;
    const totalArea = turf.area(areaCircle);
    const coveragePercentage = ((coveredArea / totalArea) * 100).toFixed(2);

    res.status(200).json({ areaId, coveragePercentage });
  } catch (error) {
    console.error('Error calculating coverage percentage:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});














// פונקציה לחשב את Set Covering עבור האזור שנבחר
// app.post('/optimize-transmitters', async (req, res) => {
//   const { name } = req.body;  // קבלת שם האזור

//   const GET_COVERAGE_AREA = gql`
//     query ($name: String!) {
//       allCoverageAreas(filter: { name: { equalTo: $name } }) {
//         nodes {
//           areaId
//           name
//           radius
//         }
//       }
//     }
//   `;

//   const GET_SYSTEM_ALLOCATIONS = gql`
//     query {
//       allSystemAllocations(filter: { areaId: { isNull: true } }) {
//         nodes {
//           transmitterName
//           allocatedRadius
//         }
//       }
//     }
//   `;

//   try {
//     // שליפת נתוני האזור שנבחר לפי ה-name
//     const areaResult = await graphqlClient.request(GET_COVERAGE_AREA, { name });
//     const coverageArea = areaResult.allCoverageAreas.nodes[0];

//     if (!coverageArea) {
//       return res.status(404).send("Coverage area not found.");
//     }

//     // שליפת נתוני המשדרים שלא משויכים לאף אזור
//     const allocationsResult = await graphqlClient.request(GET_SYSTEM_ALLOCATIONS);
//     const transmitters = allocationsResult.allSystemAllocations.nodes;

//     // הגדרת משתנים
//     let selectedTransmitters = [];
//     let uncoveredArea = coverageArea;  // נניח שהאזור מתחיל להיות לא מכוסה
//     let coveredArea = new Set();  // נשתמש ב-Set כדי לייצג את האזורים שכוסו

//     // אלגוריתם Set Covering (נמצא כמה משדרים יחד מכסים את כל האזור)
//     while (coveredArea.size < uncoveredArea.radius) {  // נמשיך עד שכל האזור מכוסה
//       let bestTransmitter = null;
//       let bestCoverage = 0;
      
//       // בודקים איזה משדר מכסה הכי הרבה את השטח הלא מכוסה
//       transmitters.forEach(transmitter => {
//         const coverage = calculateCoverage(transmitter, uncoveredArea, coveredArea);

//         if (coverage > bestCoverage) {
//           bestCoverage = coverage;
//           bestTransmitter = transmitter;
//         }
//       });

//       if (bestTransmitter) {
//         selectedTransmitters.push(bestTransmitter);
//         updateCoveredArea(coveredArea, bestTransmitter);  // עדכון אזור הכיסוי
//       }
//     }

//     // החזרת המשדרים שנבחרו
//     res.status(200).json({ selectedTransmitters });

//   } catch (error) {
//     console.error('Error during optimization:', error);
//     res.status(500).send('Server error.');
//   }
// });

// // פונקציה לחישוב כיסוי של משדר - על פי רדיוס
// function calculateCoverage(transmitter, coverageArea, coveredArea) {
//   const coverageAreaRadius = coverageArea.radius;  // רדיוס האזור
//   const transmitterRadius = transmitter.allocatedRadius;  // רדיוס המשדר

//   // חישוב שטח הכיסוי של המשדר שלא כיסה אותו קודם
//   const newCoverage = Math.min(transmitterRadius, coverageAreaRadius - coveredArea.size);
  
//   // אם יש כיסוי חדש, מחזירים את השטח
//   return newCoverage;
// }

// // פונקציה לעדכון השטח שכוסה
// function updateCoveredArea(coveredArea, transmitter) {
//   // אנחנו מניחים שהכיסוי הוא לכל היותר לפי הרדיוס של המשדר
//   coveredArea.add(transmitter.allocatedRadius);  // משדר מוסיף שטח לכיסוי
// }








app.post('/optimize-transmitters', async (req, res) => {
  const { name } = req.body;

  const GET_COVERAGE_AREA = gql`
    query ($name: String!) {
      allCoverageAreas(filter: { name: { equalTo: $name } }) {
        nodes {
          areaId
          name
          radius
        }
      }
    }
  `;

  const GET_SYSTEM_ALLOCATIONS = gql`
    query {
      allSystemAllocations(filter: { areaId: { isNull: true } }) {
        nodes {
          transmitterName
          allocatedRadius
        }
      }
    }
  `;

  try {
    // שליפת נתוני האזור
    const areaResult = await graphqlClient.request(GET_COVERAGE_AREA, { name });
    const coverageArea = areaResult.allCoverageAreas.nodes[0]; // שטח האיזור

    if (!coverageArea) {
      return res.status(404).send("Coverage area not found.");
    }

    // שליפת נתוני המשדרים
    const allocationsResult = await graphqlClient.request(GET_SYSTEM_ALLOCATIONS);
    const transmitters = allocationsResult.allSystemAllocations.nodes; // משדרים

    let selectedTransmitters = [];
    let uncoveredArea = Math.PI * Math.pow(coverageArea.radius, 2); // שטח האזור
    let coveredArea = 0; // שטח שכוסה

    // בדיקה אם יש משדר שמכסה את כל האזור
    let completeCoverageTransmitter = transmitters.find(transmitter => {
      const transmitterArea = Math.PI * Math.pow(transmitter.allocatedRadius, 2);
      return transmitterArea >= uncoveredArea;
    });

    if (completeCoverageTransmitter) {
      selectedTransmitters.push(completeCoverageTransmitter);
      return res.status(200).json({ selectedTransmitters });
    }

    // אם אין משדר אחד שמכסה את כל האזור, נמשיך לחפש את קבוצת המשדרים
    while (coveredArea < uncoveredArea) { // נמשיך עד שכל האזור מכוסה
      let bestTransmitter = null;
      let bestCoverage = 0;

      // בודקים איזה משדר מכסה הכי הרבה את השטח הלא מכוסה
      transmitters.forEach(transmitter => {
        let coverage = calculateCoverage(transmitter, uncoveredArea, coveredArea);
        
        if (coverage > bestCoverage) {
          bestCoverage = coverage;
          console.log(bestCoverage);
          bestTransmitter = transmitter;
        }
      });

      if (bestTransmitter) {
        selectedTransmitters.push(bestTransmitter);
        
        console.log('bestcoverage:'+'' + bestCoverage);
        //console.log('coveredArea' + coverageArea + 'bestCoverage' + bestCoverage + 'uncoveredArea' + uncoveredArea);
        if(coveredArea + bestCoverage > uncoveredArea) {
          console.log('//////////////////////////////////////////////////////////////////////////');
          selectedTransmitters.splice(selectedTransmitters.indexOf(bestTransmitter), 1);
          let minimaltransmittercoverage = findMinimumCoverageTransmitter(transmitter, uncoveredArea, coveredArea, bestCoverage);
          selectedTransmitters.push(minimaltransmittercoverage);
          console.log(selectedTransmitters);
          // res.status(200).json({ selectedTransmitters });
          break;
        }
        coveredArea += bestCoverage;  // עדכון השטח המכוסה
        // מסירים את המשדר שנבחר
        transmitters.splice(transmitters.indexOf(bestTransmitter), 1); // הסרה מהמערך
      }
    }

    // החזרת המשדרים שנבחרו
    console.log(selectedTransmitters);
    res.status(200).json({ selectedTransmitters });

  } catch (error) {
    console.error('Error during optimization:', error);
    res.status(500).send('Server error.');
  }
});

// פונקציה לחישוב כיסוי של משדר - על פי רדיוס
function calculateCoverage(transmitter, uncoveredArea, coveredArea) {
  const coverageAreaRadius = uncoveredArea; // שטח האזור
  const transmitterRadius = transmitter.allocatedRadius; // רדיוס המשדר

  // חישוב שטח הכיסוי של המשדר שלא כיסה אותו קודם
  const transmitterArea = Math.PI * Math.pow(transmitterRadius, 2); // שטח הכיסוי של המשדר
  const remainingCoverageArea = coverageAreaRadius - coveredArea; // השטח שנותר לכיסוי
  const newCoverage = Math.min(transmitterArea, remainingCoverageArea);
  console.log('newcoverage:' + newCoverage);
  // אם יש כיסוי חדש, מחזירים את השטח
  return newCoverage;
}

function findMinimumCoverageTransmitter(transmitters, uncoveredArea, coveredArea, bestCoverage) {
  // מיון המשדרים לפי הרדיוס - מהגדול לקטן (המשדרים הגדולים יותר מכסים שטח גדול יותר)
  transmitters = transmitters.sort((a, b) => b.allocatedRadius - a.allocatedRadius);

  let bestTransmitter = null;
  // let bestCoverage = 0;

  // transmitters.forEach(transmitter => {
  //   // חישוב כיסוי משדר
  //   const transmitterArea = Math.PI * Math.pow(transmitter.allocatedRadius, 2); // שטח הכיסוי של המשדר
  //   const remainingCoverageArea = uncoveredArea - coveredArea; // השטח שנותר לכיסוי
  //   const newCoverage = Math.min(transmitterArea, remainingCoverageArea); // כיסוי שנוסף על פי המשדר הנוכחי

  //   // אם השטח החדש מכסה את השטח הנדרש
  //   if (coveredArea + newCoverage >= uncoveredArea) {
  //     // אם זהו הכיסוי המינימלי ביותר
  //     if (!bestTransmitter || newCoverage < bestCoverage) {
  //       bestCoverage = newCoverage;
  //       bestTransmitter = transmitter;
  //     }
  //   }
  // });
  console.log('.........................................................');
  const min = bestCoverage;
  transmitters.forEach(transmitter => {
    // חישוב כיסוי משדר
    const transmitterArea = Math.PI * Math.pow(transmitter.allocatedRadius, 2); // שטח הכיסוי של המשדר
    const remainingCoverageArea = uncoveredArea - coveredArea; // השטח שנותר לכיסוי
    
    // let min = 0;
    if (transmitterArea > remainingCoverageArea) {
      if(transmitterArea < min) {
        min = transmitterArea;
      }
    }
  });

  //return bestTransmitter;
  return min;
}
































// פונקציה לניהול עוגיות (Cookies)
app.post("/createcookie", (req, res) => {
  const { name } = req.body;

  res.cookie("user", name, {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    secure: process.env.NODE_ENV === 'production' // Use secure cookies in production
  });
  res.send({ name });
});

// פונקציה למחיקת עוגיה
app.delete('/deletecookie', (req, res) => {
  res.clearCookie('user', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });
  res.status(200).send('Cookie deleted');
});

// פונקציה לקרוא עוגיה
app.get('/getcookie', (req, res) => {
  const cookie = req.cookies.user; // גישה לעוגיית 'user'
  res.send({ user: cookie });
});

// // יצירת שרת
// const server = http.createServer(app);

server.listen(5000, () => {
  console.log('server running on port 5000');
});
