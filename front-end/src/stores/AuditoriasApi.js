import { defineStore } from 'pinia'

const audiClienteStore = defineStore('mapa', {
    state: () => ({
        API_URL: '',
    }),
    actions: {
        setApiUrl(url){
            this.API_URL = url
        },
        async getAuditorias(){
            const resp = await fetch(this.API_URL);
            const auditorias = await resp.json();
            return auditorias.auditorias;
        }
    },
});

export class AuditoriasApi{
    constructor(url){
        this.AuditoriaStore = audiClienteStore()
        this.AuditoriaStore.setApiUrl(url)
    }

    async obtenerAuditorias(){
        return await this.AuditoriaStore.getAuditorias()
    }

}