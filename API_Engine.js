const fs = require('fs');
const express = require("express");
const app = express();
const cors = require('cors');
app.use(express.json());
app.use(cors())

mapa = []

function leerMapa(){
    mapa = []
    const figura = fs.readFileSync('drones_DB.json','utf-8');
    const drones = JSON.parse(figura).drones
    const posicion_a_id = {};

    drones.forEach(dron => {
        if(dron.posicion_actual){
            const key = dron.posicion_actual.toString();
            if(dron.posicion_actual.toString()=== dron.posicion_destino.toString()){
                posicion_a_id[key] = [dron.ID, 'v'];
            } else {
                posicion_a_id[key] = [dron.ID, 'r'];
            }
        }
    });

    for(let i=1; i<=20; i++){
        aux = []
        for(let j=1; j<=20; j++){
            if(posicion_a_id[[i,j].toString()]){
                aux.push(posicion_a_id[[i,j].toString()].toString())
            }
            else{
                aux.push(' ')
            }
        }
        mapa.push(aux)
    }
}



/////////////////////////////////////////////////////////
//                    Api rest
//

app.get("/",function(req,res){
    leerMapa()
    res.status(200)
    res.send(mapa)
})


app.listen(8001,()=>{
  console.log("Servidor api escuchando en el puerto", 8001);
})
