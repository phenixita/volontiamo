using Microsoft.EntityFrameworkCore;
using Npgsql;
using volontiamo.domain;

namespace volontiamo.api.Persistence;

public static class DatabaseStartup
{
    public static async Task EnsureDatabaseReadyAsync(
        IServiceProvider services,
        IConfiguration configuration,
        CancellationToken cancellationToken = default)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("Connection string 'DefaultConnection' is missing.");

        await EnsureDatabaseExistsAsync(connectionString, cancellationToken);

        using var scope = services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.MigrateAsync(cancellationToken);

        await SeedDevelopmentUserAsync(scope.ServiceProvider, configuration, cancellationToken);
    }

    private static async Task SeedDevelopmentUserAsync(
        IServiceProvider services,
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var email = configuration["DevelopmentSeed:Email"] ?? "admin@volontiamo.local";
        var password = configuration["DevelopmentSeed:Password"] ?? "Volontiamo123!";
        var firstName = configuration["DevelopmentSeed:FirstName"] ?? "Admin";
        var lastName = configuration["DevelopmentSeed:LastName"] ?? "LILT";

        var userService = services.GetRequiredService<UserService>();
        var result = await userService.CreateAsync(new CreateUserRequest(
            FirstName: firstName,
            LastName: lastName,
            Email: email,
            InitialPassword: password,
            Phone: null,
            DateOfBirth: null,
            EnrollmentDate: DateOnly.FromDateTime(DateTime.UtcNow),
            EndDate: null,
            IsActive: true,
            UserType: UserType.Lilt,
            Occupation: "Backoffice"), cancellationToken);

        if (result.Status is not ResultStatus.Ok and not ResultStatus.Conflict)
            throw new InvalidOperationException($"Development user seed failed with status {result.Status}.");
    }

    private static async Task EnsureDatabaseExistsAsync(string connectionString, CancellationToken cancellationToken)
    {
        var targetBuilder = new NpgsqlConnectionStringBuilder(connectionString);
        if (string.IsNullOrWhiteSpace(targetBuilder.Database))
            throw new InvalidOperationException("Database name is required in connection string 'DefaultConnection'.");

        var targetDatabase = targetBuilder.Database;
        var adminBuilder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            Database = "postgres",
            Pooling = false
        };

        await using var adminConnection = new NpgsqlConnection(adminBuilder.ConnectionString);
        await adminConnection.OpenAsync(cancellationToken);

        await using var existsCommand = new NpgsqlCommand(
            "SELECT 1 FROM pg_database WHERE datname = @name",
            adminConnection);
        existsCommand.Parameters.AddWithValue("name", targetDatabase);

        var exists = await existsCommand.ExecuteScalarAsync(cancellationToken) is not null;
        if (exists)
            return;

        var escapedDatabaseName = targetDatabase.Replace("\"", "\"\"");
        await using var createDatabaseCommand = new NpgsqlCommand(
            $"CREATE DATABASE \"{escapedDatabaseName}\"",
            adminConnection);
        await createDatabaseCommand.ExecuteNonQueryAsync(cancellationToken);
    }
}
