import * as ftp from 'basic-ftp';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import * as iconv from 'iconv-lite';

export class MteCaEpisService {
    static data: any[] = [];
    private nomeArquivoBase = 'tgg_export_caepi.txt';
    private urlBase = 'ftp.mtps.gov.br';
    private caminho = 'portal/fiscalizacao/seguranca-e-saude-no-trabalho/caepi/';
    private nColunas = 19;

    constructor() {}

    public async init() {
        await this.downloadAndProcessData();
    }

    private async downloadAndProcessData() {
        await this.downloadFile();
        this.processDataFile();
    }

    private async downloadFile() {
        const client = new ftp.Client();
        client.ftp.verbose = false;

        try {
            await client.access({
                host: this.urlBase,
            });

            await client.cd(this.caminho);

            // List all files in the directory
            const fileList = await client.list();

            // Filter files that match the pattern 'tgg_export_caepi.zip*'
            const matchingFiles = fileList
                .filter((file) => file.name.startsWith('tgg_export_caepi.zip'))
                .filter((file) => file.size > 0); // Exclude empty files

            if (matchingFiles.length === 0) {
                console.error('No valid files found to download.');
                return;
            }

            // Sort files by modification date (most recent first)
            matchingFiles.sort((a, b) => {
                const dateA = a.modifiedAt ? a.modifiedAt.getTime() : 0;
                const dateB = b.modifiedAt ? b.modifiedAt.getTime() : 0;
                return dateB - dateA;
            });

            // Select the most recent file
            const mostRecentFile = matchingFiles[0];
            const remoteFileName = mostRecentFile.name;
            const localFileName = 'tgg_export_caepi.zip'; // We can use a consistent local file name

            const localZipPath = path.join(__dirname, localFileName);

            // Download the most recent file
            console.log(`Downloading file: ${remoteFileName}...`);
            await client.downloadTo(localZipPath, remoteFileName);

            // Extract the ZIP file
            console.log('Extracting ZIP file...');
            const zip = new AdmZip(localZipPath);
            zip.extractAllTo(/*target path*/ __dirname, /*overwrite*/ true);

            // Remove the ZIP file after extraction
            fs.unlinkSync(localZipPath);
            console.log('ZIP file extracted and removed.');
        } catch (error) {
            console.error('Error downloading or extracting the file:', error);
        } finally {
            client.close();
        }
    }

    private processDataFile() {
        const filePath = path.join(__dirname, this.nomeArquivoBase);
        if (!fs.existsSync(filePath)) {
            console.error('Data file not found:', filePath);
            return;
        }

        console.log('Processing data file...');
        const dataBuffer = fs.readFileSync(filePath);
        const dataString = iconv.decode(dataBuffer, 'latin1');
        const lines = dataString.split('\n').filter((line) => line.trim() !== '');

        // The first line contains the headers
        const headersLine = lines.shift();
        if (!headersLine) {
            console.error('Data file is empty');
            return;
        }

        const headers = headersLine.split('|').map((header) => header.trim());
        headers[0] = 'CA'

        // Process each line into JSON objects
        const data = lines.map((line, index) => {
            const values = line.split('|');
            if (values.length !== headers.length) {
                console.warn(`Line ${index + 2} has a different number of columns. Skipping this line.`);
                return null;
            }
            const obj: any = {};
            for (let i = 0; i < headers.length; i++) {
                obj[headers[i]] = values[i] ? values[i].trim() : null;
            }
            return obj;
        }).filter((item) => item !== null);

        // Store the data in the class attribute
        MteCaEpisService.data = data;
        console.log('Data processing completed.');
    }
}