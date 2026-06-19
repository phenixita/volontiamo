using Microsoft.EntityFrameworkCore;
using volontiamo.api.Persistence;
using volontiamo.api.Users;
using volontiamo.domain;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<UserService>();

builder.Services.AddProblemDetails();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    await DatabaseStartup.EnsureDatabaseReadyAsync(app.Services, app.Configuration);
}

app.UseStatusCodePages();
app.MapUserEndpoints();

app.Run();

public partial class Program { }
