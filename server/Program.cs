using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NaviOffice.Api.Data;
using NaviOffice.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://0.0.0.0:5000");

// --- MVC / Swagger ---
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// --- Database (Sqlite для разработки, Postgres для продакшена) ---
var dbProvider = builder.Configuration["Database:Provider"] ?? "Sqlite";
var usePostgres = string.Equals(dbProvider, "Postgres", StringComparison.OrdinalIgnoreCase);
if (usePostgres)
{
    // Booking.Start/End — локальное время (Kind=Unspecified); legacy-режим хранит его
    // как timestamp without time zone вместо требования UTC.
    AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
    var pgConn = builder.Configuration.GetConnectionString("Postgres")
        ?? "Host=localhost;Port=5432;Database=navioffice;Username=navioffice;Password=navioffice";
    builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(pgConn));
}
else
{
    var sqliteConn = builder.Configuration.GetConnectionString("Sqlite") ?? "Data Source=navioffice.db";
    builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite(sqliteConn));
}

// --- Directory services (LDAP or Demo) ---
builder.Services.AddMemoryCache();
var ldapMode = builder.Configuration["Ldap:Mode"] ?? "Demo";
if (string.Equals(ldapMode, "Ldap", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<ILdapService, LdapService>();
}
else
{
    builder.Services.AddSingleton<ILdapService, DemoLdapService>();
}

builder.Services.AddSingleton<IEmployeeDirectory, CachedEmployeeDirectory>();
builder.Services.AddSingleton<JwtTokenService>();

// --- Booking (Outlook/Graph or Demo) ---
builder.Services.AddHttpClient();
var bookingMode = builder.Configuration["Booking:Mode"] ?? "Demo";
if (string.Equals(bookingMode, "Graph", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<IBookingService, GraphBookingService>();
}
else
{
    builder.Services.AddScoped<IBookingService, DemoBookingService>();
}

// --- Auth ---
var jwtKey = JwtTokenService.ResolveKey(builder.Configuration);
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            NameClaimType = "name",
            RoleClaimType = "role",
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Admin", policy => policy.RequireRole("Admin"));
    options.AddPolicy("Secretary", policy => policy.RequireRole("Admin", "Secretary"));
});

// --- CORS (dev client) ---
builder.Services.AddCors(options =>
{
    options.AddPolicy("client", policy => policy
        .WithOrigins("http://localhost:5173")
        .AllowAnyHeader()
        .AllowAnyMethod());
});

var app = builder.Build();

// --- Database create + seed ---
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    SchemaUpgrade.Apply(db, usePostgres); // доводит существующую базу до актуальной схемы
    SeedData.EnsureSeeded(db);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("client");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
