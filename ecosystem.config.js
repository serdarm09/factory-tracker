module.exports = {
    apps: [
        {
            name: "marisit-erp",
            script: "./node_modules/next/dist/bin/next",
            args: "start -p 3000",
            cwd: "c:\Users\user\Desktop\mariSit\factory-tracker",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            env: {
                NODE_ENV: "production",
            },
            exec_mode: "fork"
        },
    ],
};
