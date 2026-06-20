using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using volontiamo.api.Auth;
using volontiamo.api.Events;
using volontiamo.api.Persistence;
using volontiamo.api.Reports;
using volontiamo.api.Users;
using volontiamo.domain;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IUserPasswordHasher, ApiPasswordHasher>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<volontiamo.domain.AuthenticationService>();
builder.Services.AddScoped<IEventRepository, EventRepository>();
builder.Services.AddScoped<EventService>();
builder.Services.AddScoped<IReportingRepository, ReportingRepository>();
builder.Services.AddScoped<ReportingService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IBearerTokenService, BearerTokenService>();

var bearerSigningKey = builder.Configuration["Authentication:Bearer:SigningKey"];
if (string.IsNullOrWhiteSpace(bearerSigningKey))
{
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException("Authentication:Bearer:SigningKey is required.");

    bearerSigningKey = "development-only-volontiamo-simple-bearer-signing-key-change-me";
}

builder.Services.Configure<SimpleBearerTokenOptions>(options =>
{
    options.SigningKey = bearerSigningKey;
});

builder.Services.AddAuthentication(SimpleBearerDefaults.AuthenticationScheme)
    .AddScheme<AuthenticationSchemeOptions, SimpleBearerAuthenticationHandler>(
        SimpleBearerDefaults.AuthenticationScheme,
        options => { });
builder.Services.AddAuthorization();

builder.Services.AddProblemDetails();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    await DatabaseStartup.EnsureDatabaseReadyAsync(app.Services, app.Configuration);
}

app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();
app.MapAuthEndpoints();
app.MapUserEndpoints();
app.MapEventEndpoints();
app.MapReportEndpoints();

app.Run();

public partial class Program { }
