<template>
  <div class="mapa">
  <div>
    <!-- Numeración del 1 al 20 -->
     <h1>{{estado}}</h1>
    <div class="numbering">
      <div v-for="num in 20" :key="num" class="number">{{ num }}</div>
    </div>

    <div class="container">
      <div class="columna-izquierda">
      <div v-for="num in 20" :key="num" class="number-columna">{{ num }}</div>
      </div>
    <div class="grid">
      <div v-for="(fila, filaIndex) in mapa" :key="filaIndex">
        <div v-for="(celda, celdaIndex) in fila" :key="celdaIndex" :class="['cell', getCellClass(celda)]">
          {{ getId(celda) }}
        </div>
      </div>
    </div>
    </div>
  </div>
</div>
</template>
  
  <script>
import { defineComponent } from 'vue'
import {MapaApi} from '@/stores/MapaApi'
  export default defineComponent ({
    data() {
      return {
        mapa: [],  // Inicialmente vacío
        estado: '',
        MapaApi: new MapaApi('http://localhost:8001')
        
      };
    },
    mounted() {
      // Llamar a la API al montar el componente y establecer el intervalo
      this.obtenerMapa();
      setInterval(this.obtenerMapa, 100);  // Actualizar cada 5 segundos
    },
    methods: {
      async obtenerMapa() {
        const resultado =  await this.MapaApi.obtenerMapa()
        this.mapa = resultado.mapa
        this.estado = resultado.estado
      },
      getId(celda) {
        if (celda !== ' ') {
          return celda.split(',')[0];
        }
        return ' ';
      },
      getCellClass(celda) {
        if (celda !== ' ') {
          const status = celda.split(',')[1];
          return status === 'r' ? 'red-bg' : 'green-bg';
        }
        return '';
      }
    }
  });
  </script>
  
  <style>

  .mapa{
    place-items: center;
    display: flex;
  }
 .numbering {
  display: flex;
  margin-left: 40px;
  justify-content: space-between;
  margin-bottom: 10px; /* Espacio entre la numeración y la cuadrícula */
}
.number {
  width: 30px;
  text-align: center;
}

/* Contenedor principal */
.container {
  display: flex;
}

/* Columna izquierda con números de fila */
.columna-izquierda {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin-right: 10px; /* Espacio entre la columna y la cuadrícula */
}
.number-columna {
  width: 30px;
  text-align: center;
  line-height: 30px; /* Centrar el contenido verticalmente */
}

/* Cuadrícula */
.grid {
  display: grid;
  grid-template-columns: repeat(20, 30px); /* 20 columnas */
  gap: 1px; /* Espacio entre las celdas */
}
.cell {
  width: 30px;
  height: 30px;
  border: 1px solid black; /* Borde negro */
  text-align: center;
  line-height: 30px; /* Centrar el contenido verticalmente */
}
.red-bg {
  background-color: red;
}
.green-bg {
  background-color: green;
}
  </style>
  