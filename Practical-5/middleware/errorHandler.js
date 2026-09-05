function errorHandler(err, req, res, next) {
    console.error(err);

    if (err.name === "ValidationError") {
        return res.status(400).json({
            message: "Validation failed",
            errors: Object.fromEntries(
                Object.entries(err.errors).map(([field, details]) => [field, details.message])
            ),
        });
    }

    if (err.name === "CastError" || err.code === 11000) {
        return res.status(400).json({
            message: "Invalid task data",
        });
    }

    res.status(500).json({
        message: "Internal Server Error",
    });
}

module.exports = errorHandler;