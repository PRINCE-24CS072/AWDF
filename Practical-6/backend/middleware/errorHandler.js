function errorHandler(error, req, res, next) {
    console.error(error);

    if (error.name === "ValidationError") {
        return res.status(400).json({
            message: "Validation failed",
            errors: Object.fromEntries(
                Object.entries(error.errors).map(([field, details]) => [field, details.message])
            ),
        });
    }

    res.status(500).json({ message: "Internal Server Error" });
}

module.exports = errorHandler;