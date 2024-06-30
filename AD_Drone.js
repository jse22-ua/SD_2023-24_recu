const io = require('socket.io-client');
const fs = require('fs');
const kafka = require('kafka-node');
const readline = require('readline');
const path = require('path');
const color = require('colors');
const crypto = require('crypto');




const AD_Engine_HOST = process.argv[2];
const AD_Engine_PORT = parseInt(process.argv[3], 10);
const Broker_HOST = process.argv[4];
const Broker_PORT = parseInt(process.argv[5], 10);
const AD_Registry_HOST = process.argv[6];
const AD_Registry_PORT = parseInt(process.argv[7]);

let droneToken = '';
let ID = 2;
const lado = 20;
const puertoApi = 8000

var posicion_actual = []
var posicion_destino = []
let mostrarMapa = 's';
const direcciones = [[-1, 0], [0, 1], [1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

clavePublica = ''

//----------------------------------------------------------------------------
//            Comprobacion inicial
//parámetros conexión
//node AD_Drone.js localhost 1234 localhost 9092 localhost 8080
if (process.argv.length !== 8) {
  console.log("Uso: node AD_Drone.js <IP_AD_Engine> <PUERTO_AD_Engine> <IP_Broker> <PUERTO_Broker> <IP_AD_Registry> <PUERTO_AD_Registry>");
  process.exit(1);
}
//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
//                      Menu inicial

//menus y acciones posibles
function mainMenu() {
  rl.question('Elige una opción:\n1. Registro\n2. Unirse al espectaculo\n3. Salir\n4. Desactivar/Activar mapa\nOpcion:\n', (action) => {
    switch (action) {
      case '1':
        if(AD_Registry_PORT == puertoApi){
          registryAPI();
        } 
        else{
          connectToRegistry();
        }
        break;
      case '2':
        joinShow();
        break;
      case '3':
        rl.close();
        break;
      case '4':
        if(mostrarMapa === 's'){
          mostrarMapa = 'n';
          console.log('Mapa desactivado');
          mainMenu();
        }
        else{
          mostrarMapa = 's';
          console.log('Mapa activado');
          mainMenu();
        }
        break;
      default:
        console.log('Acción no válida. Intenta de nuevo.');
        mainMenu();
    }
  });
}
//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
//                            inicio del programa
function inicio(){
  console.log('Inicio de programa');
  mainMenu();
}

inicio();

//----------------------------------------------------------------------------


//----------------------------------------------------------------------------
//                            Registro del dron API



const URL_BASE = `http://${AD_Registry_HOST}:${puertoApi}/`;

function registryAPI() {
  console.log("Conexion por api")
  rl.question('Elige una opción:\n1. Registrar dron\n2. Dar de baja dron\n3. Actualizar dron\n4. Volver al menú principal\n5. Solicitar nuevo token:\n', (action) => {
    switch (action) {
      case '1':
        registerDrone();
        break;
      case '2':
        deleteDrone();
        break;
      case '3':
        updateDrone();
        break;
      case '4':
        mainMenu();
        break;
      case '5':
        solicitarNuevoToken();
        break;
      default:
        console.log('Acción no válida. Intenta de nuevo.');
        registryAPI();
    }
  });
}

async function solicitarNuevoToken(){
  if(ID !=-1){
    try{
          const resp = await fetch(URL_BASE + ID + '/token');
          resultado = await resp.json();
            if(resp.status == 200){
              droneToken = resultado.token;
              console.log(color.green(resultado.sucess));
            }
            if(resultado.error){
              console.log(color.red(`Error ${resp.status}: ${resultado.error}`));
            }
            mainMenu();

    }catch(e){
      console.error('Error al obtener un token', e)
    }
  }else{
    console.log('No estas registrado')
    mainMenu()
  }
}

async function registerDrone(){
  try{
    rl.question('ID: ', async (id) => {
      rl.question('Alias: ', async (alias) => {
        const drone = { ID: id, ALIAS: alias };
        const resp = await fetch(URL_BASE + 'register',{
          method:"POST",
          headers:{
            "Content-Type":"application/json",
          },
          body:JSON.stringify(drone)
        });
        resultado = await resp.json();
          if(resp.status == 200){
            ID = id;
            droneToken = resultado.drone.TOKEN;
            console.log(color.green(resultado.success));
          }
          if(resultado.error){
            console.log(color.red(`Error ${resp.status}: ${resultado.error}`));
          }
          mainMenu();
      });
    });
  }catch(e){
    console.error('Error al registrarse', e)
  }
}

async function deleteDrone(){
  try{
    rl.question('ID: ', async (droneID) => {
      const resp = await fetch(URL_BASE + droneID,{
        method:"DELETE"
      });
      resultado = await resp.json();
      if(resp.status == 200){
        console.log(color.green(resultado.success));
      }
      if(resultado.error){
        console.log(color.red(`Error ${resp.status}: ${resultado.error}`));
      }
      mainMenu();
    });
  }catch(e){
    console.error('Error al dar de baja', e)
  }
}

async function updateDrone(){
  try{
    rl.question('ID: ', (droneID) => {
          rl.question('Nuevo ID: ', (newID) => {
            rl.question('Nuevo Alias: ', async (newAlias) => {
              const updateData = { ID:newID, ALIAS:newAlias };
              const resp = await fetch(URL_BASE + droneID,{
                method:"PUT",
                headers:{
                  "Content-Type":"application/json",
                  
                },
                body:JSON.stringify(updateData)
              });
              if(resp.status == 200){
                console.log(color.green(resultado.success));
              }
              if(resultado.error){
                console.log(color.red(`Error ${resp.status}: ${resultado.error}`));
              }
              mainMenu();
            });
          });
        });
  }catch(e){
    console.error('Error al actualizarse', e)
  }
}


//
//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
//                            Registro del dron sockets

  ////////////////////////////////////////////////////////////////////////////
  //           Opciones socket


function options(socket) {
  rl.question('Elige una opción:\n1. Registrar dron\n2. Dar de baja dron\n3. Actualizar dron\n4. Volver al menú principal\n5.Solicitar nuevo token:\n', (action) => {
    switch (action) {
      case '1':
        rl.question('ID: ', (id) => {
          rl.question('Alias: ', (alias) => {

            const drone = { ID: id, ALIAS: alias };
            const encryptedDron = crypto.publicEncrypt({
              key: clavePublica,
              padding: crypto.constants.RSA_PKCS1_PADDING
            }, Buffer.from(JSON.stringify(drone)));

            //socket.emit('register', JSON.stringify(drone));
            socket.emit('register',{clave:publicKey, datos:encryptedDron});
          });
        });
        break;
      case '2':
        rl.question('ID: ', (droneID) => {
          const deregisterData = { droneID };
          const encryptedDron = crypto.publicEncrypt({
            key: clavePublica,
            padding: crypto.constants.RSA_PKCS1_PADDING
          }, Buffer.from(JSON.stringify(deregisterData)));
          //socket.emit('deregister', JSON.stringify(deregisterData));
          socket.emit('deregister', {clave:publicKey, datos:encryptedDron});
        });
        break;
      case '3':
        rl.question('ID: ', (droneID) => {
          const updateData = { action: 'update', droneID };
          const encryptedDron = crypto.publicEncrypt({
            key: clavePublica,
            padding: crypto.constants.RSA_PKCS1_PADDING
          }, Buffer.from(JSON.stringify(updateData)));
          //socket.emit('update', JSON.stringify(updateData));
          socket.emit('update', {clave:publicKey, datos:encryptedDron});
  
          socket.on('responseUpdate', (data) => {
            const descrypterResp = crypto.privateDecrypt({
              key:privateKey,
              padding: crypto.constants.RSA_PKCS1_PADDING
            }, data)
            const response = JSON.parse(descrypterResp.toString());
            if (response.success) {
              rl.question('Nuevo ID: ', (newID) => {
                rl.question('Nuevo Alias: ', (newAlias) => {
                  const updateData = { droneID, newID, newAlias };
                  const encryptedUP = crypto.publicEncrypt({
                    key: clavePublica,
                    padding: crypto.constants.RSA_PKCS1_PADDING
                  }, Buffer.from(JSON.stringify(updateData)));
                  //socket.emit('verificarUpdate', JSON.stringify(updateData));
                  socket.emit('verificarUpdate', {clave:publicKey, datos:encryptedUP});
                  console.log('Dron actualizado');
                });
              });
            } else if (response.error) {
              console.log('Error en la actualización:', response.error);
              mainMenu();
            }
          });
        });
        break;
      case '4':
        mainMenu();
        break;
      case '5':
        if(ID != -1){
          const idDron = { ID };
          const encryptedDron = crypto.publicEncrypt({
            key: clavePublica,
            padding: crypto.constants.RSA_PKCS1_PADDING
          }, Buffer.from(JSON.stringify(idDron)));
          //socket.emit('deregister', JSON.stringify(deregisterData));
          socket.emit('getToken',{clave:publicKey, datos:encryptedDron});
        }
        else{
          console.log("No estas registrado")
          mainMenu();
        }
        break;
      default:
        console.log('Acción no válida. Intenta de nuevo.');
        options(socket);
    }
  });
}
  //
  /////////////////////////////////////////////////////////////////////

  //////////////////////////////////////////////////////////////////////
  // Conexion con el servidor Registry y Lectura de datos (Socket)
function connectToRegistry() {
  const socket = io(`http://${AD_Registry_HOST}:${AD_Registry_PORT}`);

  socket.on('connect', () => {
    console.log('Conectado al servidor de AD_Registry');
  });

  socket.on('publicKey',(serverpublicKey)=>{
    clavePublica = serverpublicKey
    options(socket);
  })

  socket.on('disconnect', () => {
    console.log('Desconectado del Registro')
    setTimeout(mainMenu,1000);
  });

  socket.on('connect_error', (err) => {
    console.error('Error de conexión con el Registro:', err.message);
    socket.disconnect();
    setTimeout(mainMenu, 1000);
  });

  socket.on('error', (err) => {
    console.log('Socket error:', err);
  });

  //maneja las respuestas del socket 
  handler(socket);
}

function handler(socket){
  socket.on('responseRegister', (data) => {
    const descrypterResp = crypto.privateDecrypt({
      key:privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }, data)
    const response = JSON.parse(descrypterResp.toString());
    if (response.success) {
      ID = response.drone.ID
      droneToken = response.drone.TOKEN;
      console.log('Dron registrado. TOKEN: ' + droneToken);
    } else {
      console.log('Respuesta del servidor:', response);
    }
    socket.disconnect();
    mainMenu();
  });

  socket.on('responseToken', (data) => {
    const descrypterResp = crypto.privateDecrypt({
      key:privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }, data)
    const response = JSON.parse(descrypterResp.toString());
    if (response.success) {
      droneToken = response.drone.TOKEN;
      console.log('Dron registrado. TOKEN: ' + droneToken);
    } else {
      console.log('Respuesta del servidor:', response);
    }
    socket.disconnect();
    mainMenu();
  });

  socket.on('responseDeregister', (data) => {
      const descrypterResp = crypto.privateDecrypt({
        key:privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, data)
    const response = JSON.parse(descrypterResp.toString());
    if (response.success) {
      console.log('Dron dado de baja');
      droneToken = response.drone.TOKEN;
    } else {
      console.log('Respuesta del servidor:', response);
    }
    socket.disconnect();
    mainMenu();
  });

  socket.on('responseToken', (data) => {
    const descrypterResp = crypto.privateDecrypt({
      key:privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    }, data)
  const response = JSON.parse(descrypterResp.toString());
  if (response.success) {
    console.log('Nuevo token');
    droneToken = response.token;
    console.log(droneToken)
  } else {
    console.log('Respuesta del servidor:', response);
  }
  socket.disconnect();
  mainMenu();
});

  socket.on('responseVerify', (data) => {
    const descrypterResp = crypto.privateDecrypt({
        key:privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, data)
    const response = JSON.parse(descrypterResp.toString());
    if (response.success) {
      console.log('Nuevo ID: ');
      console.log('Nuevo Alias: ');
      droneToken = response.drone.TOKEN;
    } else {
      console.log('Respuesta del servidor:', response);
    }
    socket.disconnect();
    mainMenu();
  });
}
  //
  ///////////////////////////////////////////////////////////////////

//----------------------------------------------------------------------------




//----------------------------------------------------------------------------
//                      Autentificacion con Engine

function joinShow() {
  const engineSocket = io(`http://${AD_Engine_HOST}:${AD_Engine_PORT}`);

  engineSocket.on('connect', () => {
    console.log('Conectado al espectáculo.');
    engineSocket.emit('id', ID)
    console.log('ID: ' + ID)
    engineSocket.emit('token', droneToken)
    console.log('TOKEN: ' + droneToken)

  });

  engineSocket.on('right', (right) => {
    console.log(right)
    if (right === "Incorrecto") {
      console.log("Dato incorrecto")
      engineSocket.disconnect()
      mainMenu();
    }
    else if (right === "lleno"){
      console.log("Espectáculo lleno")
      engineSocket.disconnect()
      process.exit();
    }
    else if (right === "no"){
      console.log("CONDICIONES CLIMATICAS ADVERSAS. ESPECTACULO CANCELADO")
      engineSocket.disconnect()
      process.exit();
    }
    else if(right === "TokenExpirado"){
      console.log("Tu token ha expirado, vuelva a solicitarlo")
      engineSocket.disconnect()
      mainMenu();
    }
    else {
      console.log('Autentificación realizada correctamente')
      lanzarKafka()
      engineSocket.disconnect()

    }
  })

  engineSocket.on('mensaje', (mensaje) => {
    console.log(mensaje)
  })

  engineSocket.on('disconnect', () => {
    console.log('Desconectado del Autorización.');
  });

  engineSocket.on('error', (error) => {
    console.error('Error de conexión con el espectáculo:', error);
  })
}
//
//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
//                          Kafka

  ///////////////////////////////////////////////////////////////////
  //                  Definiciones

const Producer = kafka.Producer;
const Consumer = kafka.Consumer;
const Client = kafka.KafkaClient;

function lanzarKafka() {
  const client = new Client({ kafkaHost: `${Broker_HOST}:${Broker_PORT}` });
  const producer = new Producer(client);
  //const consumer = new Consumer(client, [{ topic: 'mapa', partition: 0 }]);
  //const newPositionConsumer = new Consumer(client,[{ topic: 'newPosition', partition: 0,fromOffset:0 }]);
  
  const consumerOptions = {
    groupId: 'my-consumer-group',
    autoCommit: true,
    autoCommitIntervalMs: 5000,
    fetchMaxBytes: 1024 * 1024,
    fetchMaxWaitMs: 1000,
    fromOffset: 'earliest', // Lee desde que se conecta
  };


const consumer = new kafka.Consumer(client, [
  { topic: 'newPosition' },
  { topic: 'mapa'}
], consumerOptions);

function Mover(mapa){
  const miDron = mapa.drones.find(d => d.id === ID);
  if (miDron && miDron.posicion_actual) {
    if(miDron.arrived){
      return false;
    }
    if(miDron.posicion_actual[0] == posicion_actual[0] && miDron.posicion_actual[1] == posicion_actual[1])
    {
      return true;
    }
  }
  return false;
}

consumer.on('message', (message) => {
  if (message.topic === 'mapa') {
    console.log('Mapa recibido:', message.value);
    if (message.value[0] !== '{') {
      console.log(message.value);
      cleanUpAndExit();
    }
    else{
      const mapa = JSON.parse(message.value);
      if (mostrarMapa === 's') {
        imprimirMapa(mapa);
      }
      console.log('Pos_destino:', posicion_destino);
      console.log('Pos_actual:', posicion_actual);
      if(posicion_actual.length != 0 && Mover(mapa)){
        calcularYEnviarMejorMovimiento();
      }
    }
  } else if (message.topic === 'newPosition') {
    console.log('Nueva posicion recibida:', message.value);
    const posicion_des = JSON.parse(message.value);
    if (posicion_des.id == ID) {
        posicion_destino = posicion_des.posicion;
        posicion_actual = [1, 1];
    }
  } else {
      // Realizar acciones para otros topics
      console.log(`Received message from topic '${message.topic}': ${message}`);
  }
});

  //
  ///////////////////////////////////////////////////////////////////

  ///////////////////////////////////////////////////////////////////
  //                   Posicion inicial en mapa

  producer.on('ready', function() {
      console.log('Productor de Kafka conectado');
      const posicionInicial = [1, 1];
      const payloads = [
        { topic: 'posiciones', messages: JSON.stringify({ id: ID, posicion: posicionInicial }) }
      ];
      producer.send(payloads, function(err, data) {
          if (err) {
              console.error('Error al enviar mensaje:', err);
          } else {
              console.log('Mensaje enviado:', data);
          }
      });

  });
  //
  ///////////////////////////////////////////////////////////////////

  ///////////////////////////////////////////////////////////////////
  //                Recibir mapa y enviar posicion  


  function enviarPosicion(nuevaPos) {
    const payloads = [
        { topic: 'posiciones', messages: JSON.stringify({ id: ID, posicion: nuevaPos }) }
    ];
    producer.send(payloads, function(err, data) {
        if (err) {
            console.error('Error al enviar mensaje:', err);
        } else {
            console.log('Mensaje enviado:', data);
        }
    });
  }

  async function calcularYEnviarMejorMovimiento() {
    const nuevaPos = calcularMejormovimiento();
    posicion_actual = nuevaPos;
    enviarPosicion(nuevaPos);
  }

  //
  ///////////////////////////////////////////////////////////////////

  ///////////////////////////////////////////////////////////////////
  //                     Gestion de errores
  consumer.on('error', function(err) {
      console.error('Error en el consumidor de Kafka:', err);
  });

  producer.on('error', function(err) {
      console.error('Error en el productor de Kafka:', err);
  });
  //
  ///////////////////////////////////////////////////////////////////


  ///////////////////////////////////////////////////////////////////
  //                        Gestion de errores

  /*newPositionConsumer.on('error', function(err) {
      console.error('Error en el consumidor de newPosition:', err);
  });*/
  //
  ///////////////////////////////////////////////////////////////////


  ///////////////////////////////////////////////////////////////////
  //                        limpieza y salida
  function cleanUpAndExit() {
    producer.close(() => console.log("Productor cerrado"));
    consumer.close(() => console.log("Consumidor cerrado"));
    //newPositionConsumer.close(() => console.log("NewPositionConsumer cerrado"));
    client.close(() => console.log("Cliente de Kafka cerrado"));
    process.exit();
  }

  process.on('SIGINT', cleanUpAndExit);
  process.on('SIGTERM', cleanUpAndExit);

  producer.on('error', function(err) {
    console.error('Error en el productor de Kafka:', err);
    cleanUpAndExit();
  });

  consumer.on('error', function(err) {
    console.error('Error en el consumidor de Kafka:', err);
    cleanUpAndExit();
  });

  /*newPositionConsumer.on('error', function(err) {
    console.error('Error en el consumidor de newPosition:', err);
    cleanUpAndExit();
  });*/

  //
  ///////////////////////////////////////////////////////////////////
}
//----------------------------------------------------------------------------


//----------------------------------------------------------------------------
//                          Calculo de posiciones

function calcularMejormovimiento() {
  mejorMovimiento = []
  nuevas_posiciones = []
  camino_min = -1
  direcciones.forEach((direccion) => {
    nueva_posicion = [posicion_actual[0] + direccion[0], posicion_actual[1] + direccion[1]]
    if (nueva_posicion[0] == 0) {
      nueva_posicion[0] = lado
    }
    if (nueva_posicion[0] == 21) {
      nueva_posicion[0] = 1
    }
    if (nueva_posicion[1] == 21) {
      nueva_posicion[1] = 1
    }
    if (nueva_posicion[1] == 0) {
      nueva_posicion[1] = lado
    }
    nuevas_posiciones.push(nueva_posicion)
  })
  nuevas_posiciones.forEach((posicion) => {
    camino = [posicion_destino[0] - posicion[0], posicion_destino[1] - posicion[1]]
    const maximo = Math.max(Math.abs(camino[0]), Math.abs(camino[1]))
    if (camino_min == -1) {
      camino_min = maximo
      mejorMovimiento = posicion
    }
    else if (maximo < camino_min) {
      camino_min = maximo
      mejorMovimiento = posicion
    }
  })
  return mejorMovimiento
}
//
//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
//                            Impresion de mapa

function imprimirMapa(mapa) {
  moviendose = mapa.drones.find((dron) => dron.arrived === false);
  if (!moviendose) {
    console.log('Figura Completada');
  }
  let encabezado = '';
  for (let i = 1; i <= lado; i++) {
    encabezado = encabezado + '   ' + (i < 10 ? '0' + i : i);
  }
  console.log(encabezado);
  for (let i = 1; i <= lado; i++) {
    mapa_a_imprimir = '';
    mapa_a_imprimir = mapa_a_imprimir + (i < 10 ? '0' + i : i);
    for (let j = 1; j <= lado; j++) {
      const dron = mapa.drones.find((dron) => dron.posicion_actual && dron.posicion_actual[0] === i && dron.posicion_actual[1] === j);
      if (dron) {
        if (dron.arrived) {
          mapa_a_imprimir = mapa_a_imprimir + ' [' + color.bgGreen(dron.id < 10 ? ' ' + dron.id : dron.id) + ']';
        }
        else {
          mapa_a_imprimir = mapa_a_imprimir + ' [' + color.bgRed(dron.id < 10 ? ' ' + dron.id : dron.id) + ']';

        }
      }
      else {
        mapa_a_imprimir = mapa_a_imprimir + ' [  ]';
      }
    }
    console.log(mapa_a_imprimir);
  }
  console.log('\n');

}

//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
//                              Codigo descartado

// guardar el token en un archivo txt
/*client.on('data', (data) => {
  const response = JSON.parse(data.toString());
  if (response.success) {
      console.log('Registro exitoso, TOKEN: ' + response.drone.TOKEN);
      // Guardar el token aquí
      // saveToken(response.drone.TOKEN);
      droneToken = response.drone.TOKEN;
  } else {
      console.log('Respuesta del servidor:', response);
  }
  options(); // Para volver al menú después de manejar la respuesta
});

function saveToken(token) {
  const tokenPath = path.join(__dirname, 'drone_token.txt');
  fs.writeFile(tokenPath, token, (err) => {
      if (err) {
          return console.log('Error al guardar el token:', err.message);
      }
      console.log('Token guardado en', tokenPath);
  });
}*/

  //kafkajs
  /*try {

    /*await producer.connect();
    console.log('Productor de Kafka conectado');
    await consumer.connect();
    console.log('Consumidor de Kafka conectado');

    const runOtherConsumer = async () => {
      await consumer.connect()
      await consumer.subscribe({ topic: 'newPosition', fromBeginning: true})
      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          posicion_des = JSON.parse(message.value)
          separar = posicion_des.split(' ')
          if (separar[0] == ID) {
            posicion_desti = separar[1].split(',')
            posicion_destino = [parseInt(posicion_desti[0]), parseInt(posicion_desti[1])]
            posicion_actual = [1, 1]
          }
        }
      })

    }

    const runProducer = async () => {
      await producer.connect()
      console.log('Productor de Kafka conectado');
      const nueva_pos = calcularMejormovimiento();
      await producer.send({
        topic: 'posiciones',
        messages: [
          { value: JSON.stringify({ id: ID, posicion: nueva_pos }) }
        ]
      })
      await producer.disconnect()
    }

    const runConsumer = async () => {
      await consumer.connect()
      console.log('Consumidor de Kafka conectado');
      await consumer.subscribe({ topic: 'mapa' })
      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          mapa = JSON.parse(message.value)
          imprimirMapa(mapa);
          const dron = mapa.drones.find((dron) => dron.id === id);
          if (dron) {
            if (!dron.arrived) {
              runProducer().catch(console.error)
            }
          }

        }
      })
    }

    (async function () {
      await runOtherConsumer().catch(console.error)
      await runProducer().catch(console.error)
      await runConsumer().catch(console.error)
    })();

    function cleanUpAndExit() {
      socket.close();
      process.exit();
    }
    process.on('SIGINT', cleanUpAndExit);
    process.on('SIGTERM', cleanUpAndExit);

  } catch (error) {
    console.error(`[ejecutarKafka] Error: ${error.message}`, error);
    process.exit(1);
  }*/

//----------------------------------------------------------------------------