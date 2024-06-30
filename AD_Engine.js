const io = require('socket.io-client');
const http = require('http');
const socketIo = require('socket.io');
const readline = require('readline');
const fs = require('fs')
const kafka = require('kafka-node');
const axios = require('axios');
const jwt = require('jwt-simple');
const moment = require('moment');


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})


const tablero = {
    drones: [

    ]
}

var figura_A_Completar = {

}

const secret = 'claveSecretaParaToken';

var estado = "normal"

//----------------------------------------------------------------------------
//                      Comprobación inicial

if (process.argv.length - 2 !== 6) {
    console.log('Número de argumentos erroneos. Debe ser así:');
    console.log('node AD_Engine.js puerto_escucha máx_drones ip_kafka puerto_kafka ip_Weather puerto_Weather');
    console.log('Por ejemplo:');
    console.log('node AD_Engine.js 4000 2 172.20.43.199 9092 172.20.43.201 5000');
    process.exit(1);
}

//
//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
//            servidor de autentificacion   

const server = http.createServer();
const socketAuto = socketIo(server);
SiguienteFigura()

socketAuto.on('connection', (client) => {
    console.log('Usuario conectado');
    console.log(estado)
    let clientIp = client.handshake.headers['x-forwarded-for'] || client.handshake.address;
    if (clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0];  // En caso de múltiples IPs, toma la primera
    }
    console.log('IP del cliente:', clientIp);

    if (tablero.drones.length == process.argv[3]) {
        client.emit('mensaje', 'No hay sitio para más drones');
        client.emit('right', 'lleno');
    }
    else if (estado != "normal") {
        console.log('El espectaculo ha finalizado')
        client.emit('mensaje', 'El espectaculo ha finalizado');
        client.emit('right', 'no');
    }
    else {
        client.emit('mensaje', 'Id: ');
        client.on('id', (id) => {
            if (id != -1) {
                fs.readFile('drones_DB.json', 'utf8', (err, data) => {
                    if (err) {
                        console.error('Error al leer drones_DB.json:', err)
                        return;
                    }
                    try {
                        const dronesData = JSON.parse(data);
                        const dron_to_seach = dronesData.drones.find(dron => dron.ID == id);
                        if (dron_to_seach) {
                            client.emit('mensaje', 'Token: ');
                            client.on('token', async (token) => {
                                if (dron_to_seach.TOKEN === token) {
                                    const this_token = jwt.decode(token, secret);
                                    console.log(this_token)
                                    const actual_time = moment().valueOf();
                                    console.log(this_token.exp)
                                    console.log(actual_time)
                                    if (actual_time < this_token.exp) {
                                        client.emit('right', 'Correcto')
                                        let aux = [1, 1];
                                        if ("posicion_actual" in dron_to_seach) {
                                            aux = dron_to_seach.posicion_actual
                                        }
                                        if (JSON.stringify(figura_A_Completar) === '{}') {
                                            if (SiguienteFigura()) {
                                                await enviarPosicionAUnDron(id, aux)
                                            } else {
                                                tablero.drones.push({ id: id, arrived: false })
                                            }
                                        } else {
                                            await enviarPosicionAUnDron(id, aux)
                                        }
                                    }
                                    else {
                                        client.emit('right', 'TokenExpirado')
                                    }
                                } else {
                                    client.emit('right', 'Incorrecto')
                                }
                            })
                        } else {
                            client.emit('right', 'Incorrecto')
                        }
                    } catch (error) {
                        console.error('Error al analizar el archivo JSON:', error);
                    }

                })
            } else {
                client.emit('right', 'Incorrecto')
            }
        })
    }
})

server.listen(process.argv[2], () => {
    console.log(`Servidor de autentificación escuchando en el puerto ${process.argv[2]}...`);
})

//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
//                              Base de datos

async function actualizarBaseDatos(id, posicion_destino, posicion_actual) {
    try {
        const drones = await fs.promises.readFile('drones_DB.json', 'utf-8');
        const dronesJSON = JSON.parse(drones);
        if (dronesJSON) {
            const dron_to_edit = dronesJSON.drones.find(d => d.ID === id);
            if (dron_to_edit) {
                dron_to_edit.posicion_actual = posicion_actual;
                dron_to_edit.posicion_destino = posicion_destino;
                await fs.promises.writeFile('drones_DB.json', JSON.stringify(dronesJSON, null, 2));
                console.log('Base de datos actualizada');
            }
            else {
                console.log('No se ha encontrado el dron en la base de datos');
            }
        }
    } catch (error) {
        console.error('Error al actualizar la base de datos:', error);
    }
}

async function actualizarBDPosicionDron(id, posicion_actual) {
    try {
        const drones = await fs.promises.readFile('drones_DB.json', 'utf-8');
        const dronesJSON = JSON.parse(drones);
        if (dronesJSON) {
            const dron_to_edit = dronesJSON.drones.find(d => d.ID === id);
            if (dron_to_edit) {
                dron_to_edit.posicion_actual = posicion_actual;
                await fs.promises.writeFile('drones_DB.json', JSON.stringify(dronesJSON, null, 2));
                console.log('Base de datos actualizada');
            }

        } else {
            console.log('No se ha encontrado el dron en la base de datos');
        }
    } catch (error) {
        console.error('Error al actualizar la base de datos:', error);
    }
}
//----------------------------------------------------------------------------
//                                       KAFKA

/////////////////////////////////////////////////////////////////
//                      Definiciones
const kafkaHost = process.argv[4] + ':' + process.argv[5];
console.log(kafkaHost);
const client = new kafka.KafkaClient({ kafkaHost: kafkaHost });
const producer = new kafka.Producer(client);
const consumer = new kafka.Consumer(
    client,
    [{ topic: 'posiciones', partition: 0 }],
    { autoCommit: false }
);

//
/////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////
//                   Enviar nuevas posiciones

async function enviarPosicionAUnDron(id, aux) {
    let thisdron = figura_A_Completar.Drones.find(d => d.ID === id)
    if (thisdron) {
        const arrayPOS = thisdron.POS.split(',').map(Number);
        await enviarNuevaPosicion(id, arrayPOS);
        tablero.drones.push({ id: id, posicion_actual: aux, posicion_destino: arrayPOS, arrived: false })
        await actualizarBaseDatos(id, arrayPOS, aux)
    }

}

async function enviarNuevaPosicion(id, posicion) {
    const mensaje = JSON.stringify({ id, posicion });
    producer.send([{ topic: 'newPosition', messages: mensaje }], function (err, data) {
        if (err) console.error('Error al enviar nueva posición:', err);
        else console.log('Nueva posición enviada:', data);
    });
}

async function enviarNuevasPosiciones() {
    for (let i = 0; i < tablero.drones.length; i++) {
        const dron = tablero.drones[i];
        if (dron.arrived == true) {
            const thisdron = figura_A_Completar.Drones.find(d => d.ID === dron.id)
            if (thisdron) {
                const arrayPOS = thisdron.POS.split(',').map(Number);
                await enviarNuevaPosicion(dron.id, arrayPOS);
                if ("posicion_actual" in dron) {
                    dron.posicion_actual = [1, 1];
                }
                dron.posicion_destino = arrayPOS;
                dron.arrived = false;
                await actualizarBaseDatos(dron.id, arrayPOS, dron.posicion_actual)
            }
        }
    }
}

/////////////////////////////////////////////////////////////////
//                      Comprobar figura completada
function figuraCompletada() {
    if (tablero.drones.length == 0) {
        return false;
    }
    const moviendose = tablero.drones.find(dron => dron.arrived == false);
    if (moviendose) {
        return false;
    }
    else {
        return true;
    }
}

//
/////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////
//                     Guardar Siguiente figura
async function SiguienteFigura() {
    try {
        const figura = await fs.promises.readFile('AwD_figuras.json', 'utf-8');
        const figuraJSON = JSON.parse(figura);
        const figuraActual = figuraJSON.figuras.shift();
        if (figuraActual) {
            figura_A_Completar = figuraActual;
            const figuraString = JSON.stringify(figuraJSON, null, 2);
            await fs.promises.writeFile('AwD_figuras.json', figuraString);
            return true;
        }
        else {
            figura_A_Completar = {}
            console.log('No hay más figuras')
            return false;
        }

    } catch (error) {
        console.error('Error al leer el archivo JSON:', error);
    }

}

//
/////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////
//                     Mover dron

function llegado(cord1, cord2) {
    if (cord1[0] == cord2[0]) {
        if (cord1[1] == cord2[1]) {
            return true
        }
    }
    return false;
}

function posicionConsecutiva(pos, pos_actual) {
    difx = pos[0] - pos_actual[0]
    dify = pos[1] - pos_actual[1]
    if (difx == 0 || Math.abs(difx) == 1) {
        if (difx == 0 || Math.abs(difx) == 1) {
            return true;
        }
    }
    return false;
}

const movimiento = () => {
    consumer.on('message', function (message) {
        const position = JSON.parse(message.value);
        const dron_to_move = tablero.drones.find(dron => dron.id === position.id);
        if (dron_to_move) {
            if (posicionConsecutiva(position.posicion, dron_to_move.posicion_actual)) {
                dron_to_move.posicion_actual = position.posicion;
                if (llegado(position.posicion, dron_to_move.posicion_destino)) {
                    dron_to_move.arrived = true;
                }
                actualizarBDPosicionDron(position.id, position.posicion)
            }
        }
    });
};

//
/////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////
//                  Enviar tablero 
async function enviarEstadoTablero(thistablero) {
    const mensaje = JSON.stringify(thistablero);
    producer.send([{ topic: 'mapa', messages: mensaje }], function (err, data) {
        if (err) console.error('Error al enviar estado del tablero:', err);
        else console.log('Estado del tablero enviado:', data);
    });
}

async function enviarTableroCadaSegundo() {
    if (tablero.drones.length == 0) {
        return;
    }
    if (estado === "CONDICIONES CLIMATICAS ADVERSAS. ESPECTACULO FINALIZADO" || estado === "STOP") {
        await enviarEstadoTablero(estado);
        clearInterval(idInterval1)
        clearInterval(idInterval2)
    } else {
        await enviarEstadoTablero(tablero);
    }
}
//
/////////////////////////////////////////////////////////////////



/////////////////////////////////////////////////////////////////
//                      conexion con kafka
async function cambiarFigura() {
    if (figuraCompletada() && JSON.stringify(figura_A_Completar.length) != '{}') {
        let lleno = await SiguienteFigura()
        if (lleno) {
            await enviarNuevasPosiciones()
        }
    }

}

producer.on('ready', function () {
    console.log('Productor de Kafka conectado');
    idInterval1 = setInterval(async () => { await cambiarFigura().catch(console.error) }, 5000);
    idInterval2 = setInterval(async () => { await enviarTableroCadaSegundo().catch(console.error) }, 1000);
    (async () => {
        movimiento()
    })();

});

producer.on('error', function (error) {
    console.error('Error en el productor de Kafka');
    console.log('No se pudo conectar a kafka porfavor expere')
});

consumer.on('message', function (message) {
    //console.log('Mensaje recibido:', message);
    try {
        const datosDron = JSON.parse(message.value);
        const dron = tablero.drones.find(d => d.id === datosDron.id);
        if (dron) {
            dron.posicion_actual = datosDron.posicion;
        }
    } catch (error) {
        console.error('Error al procesar el mensaje:', error);
    }
});

consumer.on('error', function (error) {
    console.error('Error en el consumidor de Kafka:', error);
});


//
//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
//                              cliente de clima
/*const url = 'http://' + process.argv[6] + ':' + process.argv[7]

const socket = io(url);

socket.on('connect', () => {
    console.log('Conectado con servidor clima');
    socket.emit('cuidad');
})


const idInterval = setInterval(() => {
    socket.emit('cuidad');
}, 5000);


socket.on('mensaje', (msg) => {
    console.log(msg);
});

socket.on('temperatura', (temp) => {
    if (temp <= 0) {
        clearInterval(idInterval);
        console.log('CONDICIONES CLIMATICAS ADVERSAS. ESPECTACULO FINALIZADO')
        estado = "CONDICIONES CLIMATICAS ADVERSAS. ESPECTACULO FINALIZADO" 
        socket.disconnect();
    }
})

socket.on('disconnect', () => {
    rl.close()
})
*/
//
//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
//                             api temperatura



let idIntervalo1;
async function getTemperature() {
    const data = await fs.promises.readFile('api_key.json', 'utf-8');
    const datos = JSON.parse(data);
    const apiKey = datos.api_key;
    const city = datos.city;
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}`;
    const response = await axios.get(apiUrl);
    const temperature = Math.round(response.data.main.temp - 273.15);
    return temperature;

}

function continuarEspectaculo() {
    getTemperature().then((temperature) => {
        if (temperature <= 0) {
            clearInterval(idInterval);
            console.log('CONDICIONES CLIMATICAS ADVERSAS. ESPECTACULO FINALIZADO')
            estado = "CONDICIONES CLIMATICAS ADVERSAS. ESPECTACULO FINALIZADO"
            console.log(estado);
        }
    }).catch((error) => {
        console.log("No se pudo leer el archivo o algun dato es incorrecto");
    });

}

idInterval = setInterval(() => { continuarEspectaculo() }, 4000);

//
//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
//                                 Auditoria

function apuntarEvento(ip='', evento, parametros=[]){
    fs.readFile('auditorias.json', 'utf-8',(err,datos)=>{
        if (err) {
            console.error('Error al leer el archivo:', err);
            return;
        }

        let auditoriasJSON;
        try {
            // Parsear el contenido del archivo JSON
            auditoriasJSON = JSON.parse(data);
        } catch (err) {
            console.error('Error al parsear el JSON:', err);
            return;
        }

        // Obtener la fecha y hora actual
        let fechaHoraActual = new Date().toISOString();
        
        // Crear el objeto de auditoría
        let auditoria = {
            "fechaHora": fechaHoraActual,
            "ip": ip,
            "evento": evento,
            "parametros": parametros
        };
        
        // Añadir la auditoría al array
        auditoriasJSON.auditorias.push(auditoria);

        // Escribir el archivo JSON actualizado
        fs.writeFile(path, JSON.stringify(auditoriasJSON, null, 2), (err) => {
            if (err) {
                console.error('Error al escribir el archivo:', err);
                return;
            }
            console.log('Auditoría añadida correctamente');
        });
    })

}

//
//----------------------------------------------------------------------------

//----------------------------------------------------------------------------
//                              Salir
function salirEngine() {
    rl.question('Para server escribiendo STOP...', (salir) => {
        if (salir.toUpperCase() == 'STOP') {
            clearInterval(idInterval)
            clearInterval(idIntervalo1)
            estado = "STOP"
            socket.disconnect();
            process.exit();
        }
        else {
            salirEngine()
        }

    })
}

salirEngine()

//
//----------------------------------------------------------------------------