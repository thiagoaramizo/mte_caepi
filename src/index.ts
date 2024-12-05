import { MteCaEpisService } from './MteCaEpisService';

async function main() {
    const service = new MteCaEpisService();
    await service.init();

    console.log('Total:', MteCaEpisService.data.length);
    console.log('First:',  MteCaEpisService.data[0]);

}

main();