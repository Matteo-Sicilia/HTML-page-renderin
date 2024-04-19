import fastifyStatic from "@fastify/static";
import fastify from "fastify";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fastifyView from "@fastify/view";
import ejs from "ejs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fruits = ["Banana", "Pera", "Mela", "Kiwi", "Fragola"];

export default async function createServer() {
    const app = fastify({
        logger: {
            transport: {
                target: "pino-pretty",
            },
        },
    });

    await app.register(fastifyStatic, {
        root: join(__dirname, "assets"),
        prefix: "/static",
    });

    await app.register(fastifyView, {
        engine: {
            ejs: ejs,
        },
    });

    app.get("/", async (req, res) => {
        return res.view("./views/index.ejs", {fruits: fruits});
    });

    app.get("/about", async (req, res) => {
        const content = await readFile("./pages/about.html", {
            encoding: "utf-8",
        });
        res.header("Content-Type", "text/html");
        return content;
    });

    return app;
}
