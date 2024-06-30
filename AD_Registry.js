const fs = require('fs');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const jwt = require('jwt-simple');
const moment = require('moment');
const express = require("express");
const app = express();
const crypto = require('crypto');
app.use(express.json());


const {publicKey, privateKey} = crypto.generateKeyPairSync('rsa',{
  modulusLength: 2048,
  publicKeyEncoding:{
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});



const puertoApi = 8000

const secret = 'claveSecretaParaToken';

if (process.argv.length !== 3) {
  console.log("Uso: node AD_Registry.js <PUERTO>");
  process.exit(1);
}

/////////////////////////////////////////////////////////
//                    Api rest
//

app.get("/",(req,res)=>{
  res.status(200);
  res.send(publicKey);
})

app.get("/:id/token",(req,res)=>{
  const id = parseInt(req.params.id)
  getToken(id, (response)=>{
    if(response.error){
      if(response.error === 'Drone not found'){
        res.status(404);
        res.send(response)
      }
      else{
        res.status(500);
        res.send(response)
      }
    }else{
      res.status(200);
      res.send(response);
    }
  })
})

app.post("/register",function(req,res){
  const drone = req.body;
  registerDrone(drone, (response)=>{
    if(response.error){
      if(response.error === 'Ya existe un dron con el id: ' + drone.ID){
        res.status(400)
        console.log(response);
        res.send(response)
      }
      else{
        res.status(500)
        console.log(response)
        res.send(response)
      }
    }
    else{
      res.status(200);
      console.log(response);
      res.send(response);
    }
  })
})

app.put("/:id", function(req,res){
  const id = parseInt(req.params.id)
  const drone = req.body;
  verificarUpdate(id, drone.ID,drone.ALIAS,(response)=>{
    if(response.error){
      if(response.error === 'Drone not found'){
        res.status(404);
        res.send(response)
      }
      else{
        res.status(500);
        res.send(response)
      }
    }else{
      res.status(200);
      res.send(response);
    }
  });
})

app.delete("/:id",function(req,res){
  var id = parseInt(req.params.id)
  deregisterDrone(id,(response)=>{
    if(response.error){
      if(response.error === 'Drone not found'){
        res.status(404)
        res.send(response)
      }
      else{
        res.status(500)
        res.send(response);
      }
    }else{
      res.status(200)
      res.send(response);
    }
  })
})

app.listen(puertoApi,()=>{
  console.log("Servidor api escuchando en el puerto", puertoApi);
})


////////////////////////////////////////////////////////
//            sockets
//

const PORT = process.argv[2];

const server = http.createServer();
const io = socketIO(server);

io.on('connection', (socket) => {
  console.log('[Cliente conectado]');
  socket.emit('publicKey',publicKey);

  socket.on('register', (datos) => {
    let client_publicKey = datos.clave
    const descrypterDron = crypto.privateDecrypt({
      key:privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }, datos.datos)

    const data = JSON.parse(descrypterDron.toString());

    registerDrone(data, (response) => {
      console.log(response)
      const encryptedToken = crypto.publicEncrypt({
        key: client_publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, Buffer.from(JSON.stringify(response)));

      //socket.emit('responseRegister', JSON.stringify(response));
      socket.emit('responseRegister', encryptedToken);
    });
  });

  socket.on('getToken', (datos) => {
    let client_publicKey = datos.clave
    const descrypterDron = crypto.privateDecrypt({
      key:privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }, datos.datos)

    const data = JSON.parse(descrypterDron.toString()).ID;
    console.log(data)
    getToken(data, (response) => {
      console.log(response)
      const encryptedToken = crypto.publicEncrypt({
        key: client_publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, Buffer.from(JSON.stringify(response)));

      //socket.emit('responseRegister', JSON.stringify(response));
      socket.emit('responseToken', encryptedToken);
    });
  });

  socket.on('deregister', (droneID) => {
    client_publicKey = datos.clave
    const descrypterDron = crypto.privateDecrypt({
      key:privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }, droneID.datos)
    const data = JSON.parse(descrypterDron.toString());
    const droneId = data.droneID;
    deregisterDrone(droneId, (response) => {
      const encryptedRes = crypto.publicEncrypt({
        key: client_publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, Buffer.from(JSON.stringify(response)));
      //socket.emit('responseDeregister', JSON.stringify(response));
      socket.emit('responseDeregister', encryptedRes);
    });
  });

  socket.on('update', (droneID) => {
    const descrypterDron = crypto.privateDecrypt({
      key:privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }, droneID)
    const data = JSON.parse(descrypterDron.toString());
    const droneId = data.droneID;
    updateDrone(droneId, (response) => {
      const encryptedRes = crypto.publicEncrypt({
        key: client_publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, Buffer.from(JSON.stringify(response)));
      //socket.emit('responseUpdate', JSON.stringify(response));
      socket.emit('responseUpdate', encryptedRes);
    });
  });

  socket.on('verificarUpdate', (dataJSON) => { 
    const descrypterDron = crypto.privateDecrypt({
      key:privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }, dataJSON)
    const { droneID, newID, newAlias } = JSON.parse(descrypterDron.toString());

    verificarUpdate(droneID, newID, newAlias, (response) => {
      const encryptedRes = crypto.publicEncrypt({
        key: client_publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, Buffer.from(JSON.stringify(response)));
      //socket.emit('responseVerify', JSON.stringify(response));
      socket.emit('responseVerify', encryptedRes);
    });
  });

  socket.on('disconnect', () => {
    console.log('[Cliente desconectado]');
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

server.listen(PORT, () => {
  console.log('Servidor socket escuchando en el puerto', PORT);
});

function generateRandomToken(alias) {
  const payload = { 
    alias:alias,
    exp: moment().add(20, 'seconds').valueOf()
  };
  const TOKEN = jwt.encode(payload, secret);
  return TOKEN;
}
///////////////////////////////////////////////////////////////////
//acciones. Registro, baja y actualización de drones

//dar de alta
function registerDrone(drone, callback) {
  const dbFilePath = path.join(__dirname, 'drones_DB.json');
  fs.readFile('drones_DB.json', 'utf-8', (err, data) => {
    if (err) {
      console.error('Error de lectura de la BD:', err);
      callback({ error: 'Database read error' });
      return;
    }

    try {
      const database = JSON.parse(data);
      const newToken = generateRandomToken(drone.ALIAS);
      const newDrone = {
        ID: parseInt(drone.ID),
        ALIAS: drone.ALIAS,
        TOKEN: newToken,
      };
      const existingIndex = database.drones.findIndex(d => d.ID == drone.ID);

      if (existingIndex !== -1) {
        callback({ error: 'Ya existe un dron con el id: ' + drone.ID});
        return;
      }

      database.drones.push(newDrone);
      fs.writeFile(dbFilePath, JSON.stringify(database, null, 2), (err) => {
        if (err) {
          console.error('Error de escritura de la BD:', err);
          callback({ action: 'register', error: 'Database write error' });
        }else{
          console.log('Dron registrado:', newDrone);
          console.log('tiempo que expira', jwt.decode(newToken,secret).exp);
          callback({ action: 'register', success: 'Dron registrado', drone: newDrone });
        }
      });
    } catch (error) {
      console.error('Error en la BD:', error);
      callback({ error: 'Database parse error' });
    }
  });
}

//dar de baja
function deregisterDrone(droneID, callback) {
  const dbFilePath = path.join(__dirname, 'drones_DB.json');
  fs.readFile(dbFilePath, 'utf-8', (err, data) => {
    if (err) {
      console.error('Error de lectura de la BD:', err);
      callback({ error: 'Database read error' });
      return;
    }

    try {
      const database = JSON.parse(data);
      const index = database.drones.findIndex((drone) => drone.ID == droneID);
      if (index !== -1) {
        const removedDrone = database.drones.splice(index, 1)[0];
        fs.writeFile(dbFilePath, JSON.stringify(database, null, 2), (err) => {
          if (err) {
            console.error('Error escritura de la BD:', err);
            callback({ action: 'register', error: 'Database write error' });
          } else {
            console.log('Dron dado de baja:', removedDrone);
            callback({ action: 'deregister', success: 'Dron dado de baja', drone: removedDrone });
          }
        });
      } else {
        console.error('Dron no encontrado:', droneID);
        callback({ error: 'Drone not found' });
      }
    } catch (error) {
      console.error('Error en la BD:', error);
      callback({ error: 'Database parse error' });
    }
  });
}

//dar nuevo token
function getToken(droneID,callback) {
  const dbFilePath = path.join(__dirname, 'drones_DB.json');
  fs.readFile(dbFilePath, 'utf-8', (err, data) => {
    try {
      const database = JSON.parse(data);
      const droneIndex = database.drones.findIndex(d => d.ID == droneID); 

      if (droneIndex !== -1) { 
        const token = generateRandomToken('nuevo'+droneID*20);
        database.drones[droneIndex].TOKEN = token; 
        fs.writeFile(dbFilePath, JSON.stringify(database, null, 2), 'utf-8', (err) => {
            if (err) {
                console.error('Error al escribir en la BD:', err);
                callback({ error: 'Error al actualizar la base de datos' });
            } else {
              callback({ sucess: "Dron actualizado", token:token});
            }
        });
      } else {
        callback({ error: 'Dron no encontrado con el ID proporcionado.' });
      }
    } catch (error) {
      console.error('Error de análisis de la BD:', error);
      callback({ error: 'Error al analizar la base de datos' });
    }
  });
}

// actualizar
function updateDrone(droneID,callback) {
  const dbFilePath = path.join(__dirname, 'drones_DB.json');
  fs.readFile(dbFilePath, 'utf-8', (err, data) => {
    if (err) {
        console.error('Error de lectura de la BD:', err);
        callback({ error: 'Error al leer la base de datos' });
        return;
    }

    try {
      const database = JSON.parse(data);
      const indexToUpdate = database.drones.findIndex(d => d.ID == droneID);
      if (indexToUpdate === -1) {
        callback({ error: 'Dron no existente. No se puede actualizar.' });
        return;
      }else{
        callback({ success: "Dron existente" });
      }
    } catch (error) {
      console.error('Error de análisis de la BD:', error);
      callback({ error: 'Error al analizar la base de datos' });
    }
  });
}

function verificarUpdate(droneID,newID,newAlias,callback) {
  const dbFilePath = path.join(__dirname, 'drones_DB.json');
  fs.readFile(dbFilePath, 'utf-8', (err, data) => {
    try {
      const database = JSON.parse(data);
      const droneIndex = database.drones.findIndex(d => d.ID == droneID); 

      if (droneIndex !== -1) { 
        database.drones[droneIndex].ID = parseInt(newID); 
        database.drones[droneIndex].ALIAS = newAlias;
        fs.writeFile(dbFilePath, JSON.stringify(database, null, 2), 'utf-8', (err) => {
            if (err) {
                console.error('Error al escribir en la BD:', err);
                callback({ error: 'Error al actualizar la base de datos' });
            } else {
              callback({ sucess: "Dron actualizado" });
            }
        });
      } else {
        callback({ error: 'Dron no encontrado con el ID proporcionado.' });
      }
    } catch (error) {
      console.error('Error de análisis de la BD:', error);
      callback({ error: 'Error al analizar la base de datos' });
    }
  });
}
                                                                  //
                                                                  //
////////////////////////////////////////////////////////////////////