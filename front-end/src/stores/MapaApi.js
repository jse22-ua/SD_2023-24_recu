import { defineStore } from 'pinia'

const mapaClienteStore = defineStore('mapa', {
    state: () => ({
        API_URL: '',
    }),
    actions: {
        setApiUrl(url){
            this.API_URL = url
        },
        async getMapa(){
            const resp = await fetch(this.API_URL);
            this.tablero = await resp.json();
            return this.tablero;
        }
    },
});

export class MapaApi{
    constructor(url){
        this.mapaStore = mapaClienteStore()
        this.mapaStore.setApiUrl(url)
    }

    async obtenerMapa(){
        return await this.mapaStore.getMapa()
    }

}