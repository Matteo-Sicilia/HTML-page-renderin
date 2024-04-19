import fastifyStatic from "@fastify/static";
import fastify from "fastify";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fastifyView from "@fastify/view";
import ejs from "ejs";
import fastifyPostgres from "@fastify/postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
        layout: "template.ejs",
    });

    await app.register(fastifyPostgres, {
        host: "127.0.0.1",
        port: 8080,
        database: "lezioni_node",
        user: "postgres",
        password: "pinocembro",
    });

    app.get("/", async (req, res) => {
        const del = req.query.delete;

        if (del) {
            const delResult = await app.pg.query(
                "DELETE FROM todos WHERE id = $1",
                [del]
            );
            if (delResult.rowCount === 0) {
                throw new Error("Not found");
            }
        }
        const result = await app.pg.query("SELECT * FROM todos");
        return res.view("./views/index.ejs", { todos: result.rows });
    });

    app.get("/about", async (req, res) => {
        return res.view("./views/about.ejs");
    });

    return app;
}
