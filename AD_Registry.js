const fs = require('fs');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const jwt = require('jwt-simple');
const moment = require('moment');
const express = require("express");
const app = express();
app.use(express.json());


const secret = 'claveSecreta';

if (process.argv.length !== 3) {
  console.log("Uso: node AD_Registry.js <PUERTO>");
  process.exit(1);
}

/////////////////////////////////////////////////////////
//                    Api rest
//

app.post("/register",function(req,res){
  const drone = req.body;
  registerDrone(drone, (response)=>{
    res.json(response);
  })
})

app.put("/update", function(req,res){

})

app.delete("/delete",function(req,res){

})

app.listen(8000,()=>{
  console.log("Servidor escuchando en el puerto 8000");
})


////////////////////////////////////////////////////////
//            sockets
//

const PORT = process.argv[2];
const server = http.createServer();
const io = socketIO(server);

io.on('connection', (socket) => {
  console.log('[Cliente conectado]');

  socket.on('register', (dataJSON) => {
    const data = JSON.parse(dataJSON);
    registerDrone(data, (response) => {
      socket.emit('responseRegister', JSON.stringify(response));
    });
  });

  socket.on('deregister', (droneID) => {
    const data = JSON.parse(droneID);
    const droneId = data.droneID;
    deregisterDrone(droneId, (response) => {
      socket.emit('responseDeregister', JSON.stringify(response));
    });
  });

  socket.on('update', (droneID) => {
    const data = JSON.parse(droneID);
    const droneId = data.droneID;
    updateDrone(droneId, (response) => {
      socket.emit('responseUpdate', JSON.stringify(response));
    });
  });

  socket.on('verificarUpdate', (dataJSON) => { 
    const { droneID, newID, newAlias } = JSON.parse(dataJSON);
    verificarUpdate(droneID, newID, newAlias, (response) => {
      socket.emit('responseVerify', JSON.stringify(response));
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
  console.log('Servidor escuchando en el puerto', PORT);
});

function generateRandomToken(alias) {
  const payload = { 
    alias:alias,
    exp: moment().add(20, 'seconds').valueOf()
  };
  const TOKEN = jwt.encode(payload, secret);
  return TOKEN;
}

//acciones. Registro, baja y actualización de drones

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
              callback({ error: "Dron actualizado" });
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