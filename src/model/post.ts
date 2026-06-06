import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional } from 'sequelize';
import sequelize from '../db/sequelizeConfig.js';
import User from './user.js';

/**
 * Sample resource — replace with your domain. Keep the FK to users
 * with onDelete:'CASCADE' so a deleted user takes their content with
 * them (GDPR / RTBF default).
 */
export class Post extends Model<
  InferAttributes<Post>,
  InferCreationAttributes<Post>
> {
  declare id: CreationOptional<string>;
  declare title: string;
  declare body: string;
  declare authorId: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Post.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [1, 200] },
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [1, 10_000] },
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'author_id',
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'posts',
    underscored: true,
    indexes: [{ name: 'posts_author_created_idx', fields: ['author_id', 'created_at'] }],
  },
);

// Associations. Keep them in the model file (not a separate
// associate() phase) so import-side-effect order is enough to wire
// everything up.
User.hasMany(Post, { as: 'posts', foreignKey: 'authorId' });
Post.belongsTo(User, { as: 'author', foreignKey: 'authorId' });

export default Post;
