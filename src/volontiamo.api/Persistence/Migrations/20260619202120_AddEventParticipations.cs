using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace volontiamo.api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEventParticipations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_participations",
                columns: table => new
                {
                    event_id = table.Column<int>(type: "integer", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    participation_status = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_event_participations", x => new { x.event_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_event_participations_events_event_id",
                        column: x => x.event_id,
                        principalTable: "events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_event_participations_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_event_participations_event_id",
                table: "event_participations",
                column: "event_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_participations_user_id",
                table: "event_participations",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_event_participations_user_id_status",
                table: "event_participations",
                columns: new[] { "user_id", "participation_status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_participations");
        }
    }
}
