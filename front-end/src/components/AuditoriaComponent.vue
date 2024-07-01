<template>
  <div>
    <h2>Listado de Auditorías</h2>
    <table>
      <thead>
        <tr>
          <th>Fecha y Hora</th>
          <th>IP</th>
          <th>Ubicación</th>
          <th>Evento</th>
          <th>Parámetros</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(auditoria, index) in listado" :key="index">
          <td>{{ auditoria.fechaHora }}</td>
          <td>{{ auditoria.ip }}</td>
          <td>{{ auditoria.Donde }}</td>
          <td>{{ auditoria.evento }}</td>
          <td>
            <ul>
              <li v-for="(param, idx) in auditoria.parametros" :key="idx">{{ param }}</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import { AuditoriasApi } from '@/stores/AuditoriasApi'

export default defineComponent({
  data() {
    return {
      listado: [],  // Inicialmente vacío
      AuditoriaApi: new AuditoriasApi('http://localhost:8001/auditoria')
    };
  },
  async mounted() {
    // Llamar a la API al montar el componente y establecer el intervalo
    await this.obtenerAuditorias();
    setInterval(await this.obtenerAuditorias, 5000);  // Actualizar cada 5 segundos
  },
  methods: {
    async obtenerAuditorias() {
      this.listado = await this.AuditoriaApi.obtenerAuditorias();
    }
  },
});
</script>

<style>
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
}

th, td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

th {
  background-color: #f2f2f2;
}

tr:nth-child(even) {
  background-color: #f9f9f9;
}

tr:hover {
  background-color: #ddd;
}

h2 {
  margin-bottom: 20px;
}
</style>
