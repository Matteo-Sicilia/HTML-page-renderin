import fastifyStatic from "@fastify/static";
import fastify from "fastify";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fastifyView from "@fastify/view";
import ejs from "ejs";
import fastifyPostgres from "@fastify/postgres";
import fastifyFormbody from "@fastify/formbody";
import fastifyCookie from "@fastify/cookie";
import {} from "node:crypto";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sessions = [];

export default async function createServer() {
    const app = fastify({
        logger: {
            transport: {
                target: "pino-pretty",
            },
        },
    });

    await app.register(fastifyCookie, {
        secret: "pino",
        parseOptions: {
            httpOnly: true,
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

    await app.register(fastifyFormbody);

    await app.register(fastifyPostgres, {
        host: "127.0.0.1",
        port: 8080,
        database: "lezioni_node",
        user: "postgres",
        password: "pinocembro",
    });

    app.get("/", async (req, res) => {
        const { delete: del, done } = req.query;
        let session = undefined;
        if (req.cookies.uuid) {
            const uuid = req.unsignCookie(req.cookies.uuid).value;
            session = sessions.find((x) => x.uuid === uuid);
        }

        if (del) {
            const delResult = await app.pg.query(
                "DELETE FROM todos WHERE id = $1",
                [del]
            );
            if (delResult.rowCount === 0) {
                throw new Error("Not found");
            }
            res.redirect("/");
        }

        if (done) {
            const doneResult = await app.pg.query(
                "UPDATE todos SET done = NOT done WHERE id = $1",
                [done]
            );
            if (doneResult.rowCount === 0) {
                throw new Error("Not found");
            }
            res.redirect("/");
        }

        const result = await app.pg.query(
            "SELECT * FROM todos ORDER BY id DESC"
        );
        return res.view("./views/index.ejs", { todos: result.rows, session });
    });

    app.get("/about", async (req, res) => {
        return res.view("./views/about.ejs");
    });

    app.get("/login", async (req, res) => {
        return res.view("./views/login.ejs");
    });

    app.post("/login", async (req, res) => {
        const username = req.body.username;

        const uuid = randomUUID();
        const session = {
            uuid,
            username,
        };

        sessions.push(session);
        res.cookie("uuid", uuid, { signed: true });
        return res.redirect("/");
    });

    app.get("/create", async (req, res) => {
        res.cookie("prova", "ciao", { signed: true });
        res.cookie("isAdmin", "false", { signed: true });
        return res.view("./assets/create.ejs");
    });

    app.post("/create", async (req, res) => {
        const result = await app.pg.query(
            "INSERT INTO todos (label, done) VALUES ($1, $2)",
            [req.body.label, !!req.body.done]
        );

        if (result.rowCount !== 1) {
            throw new Error("Error");
        }
        app.log.info(req.body);
        return res.redirect("/");
    });

    app.put("/edit", async (req, res) => {
        const id = req.body.id;
        if (!id) {
            return res
                .status(400)
                .send({ error: "Missing id in request body" });
        }

        try {
            const detail = await app.pg.query(
                "SELECT * FROM todos WHERE id = $1",
                [id]
            );

            if (detail.rowCount === 0) {
                return res.status(404).send({ error: "Todo not found" });
            }

            const todo = detail.rows[0];

            const result = await app.pg.query(
                "UPDATE todos SET label = $1, done = $2 WHERE id = $3",
                [req.body.label, !!req.body.done, id]
            );

            if (result.rowCount !== 1) {
                throw new Error("Error updating todo");
            }

            return res.redirect("/");
        } catch (error) {
            console.error(error);
            return res.status(500).send({ error: "Internal server error" });
        }
    });

    return app;
}
